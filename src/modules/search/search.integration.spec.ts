import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { SearchListingsQueryDto } from './dto';
import type { SearchRoomType } from './search.constants';
import { SearchService } from './search.service';

interface ActiveListingFixture {
  id: string;
  title: string;
  price: string;
  area: string;
  roomType: string;
  latitude: number;
  longitude: number;
}

interface CountRow {
  count: string;
}

interface ExtensionRow {
  extname: string;
}

interface IndexRow {
  indexname: string;
}

interface KeywordRow {
  title: string;
}

interface AmenityRow {
  id: string;
  amenities: number[];
}

const DATABASE_TO_API_ROOM_TYPE: Record<string, SearchRoomType> = {
  phong_tro: 'phong_tro',
  phong_don_co_ban: 'phong_tro',
  phong_don_wc_rieng: 'phong_tro',
  phong_gac_lung: 'phong_tro',
  phong_may_lanh: 'phong_tro',
  nha_nguyen_can: 'nha_nguyen_can',
  chung_cu_mini: 'chung_cu_mini',
  ky_tuc_xa: 'ky_tuc_xa',
  studio: 'studio',
  studio_mini: 'studio',
  can_ho_dich_vu: 'can_ho_dich_vu',
};

void describe('SearchService voi PostgreSQL va PostGIS', () => {
  let application: INestApplicationContext;
  let dataSource: DataSource;
  let searchService: SearchService;
  let fixture: ActiveListingFixture;

  void before(async () => {
    application = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    dataSource = application.get(DataSource);
    searchService = application.get(SearchService);

    const fixtures = await dataSource.query<ActiveListingFixture[]>(`
      SELECT
        id,
        title,
        price,
        area,
        room_type AS "roomType",
        ST_Y(location) AS latitude,
        ST_X(location) AS longitude
      FROM listings
      WHERE status = 'active'
        AND deleted_at IS NULL
        AND location IS NOT NULL
      ORDER BY created_at DESC, id ASC
      LIMIT 1
    `);

    assert.ok(
      fixtures[0],
      'Can it nhat mot tin active co location de chay test',
    );
    fixture = fixtures[0];
  });

  void after(async () => {
    await application.close();
  });

  void it('xac nhan PostGIS, unaccent va cac spatial index dang hoat dong', async () => {
    const extensions = await dataSource.query<ExtensionRow[]>(`
      SELECT extname
      FROM pg_extension
      WHERE extname IN ('postgis', 'unaccent')
      ORDER BY extname
    `);
    const indexes = await dataSource.query<IndexRow[]>(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'listings'
        AND indexname IN (
          'idx_listings_location',
          'idx_listings_location_geography',
          'idx_listings_active_created_at'
        )
      ORDER BY indexname
    `);

    assert.deepEqual(
      extensions.map((extension) => extension.extname),
      ['postgis', 'unaccent'],
    );
    assert.deepEqual(
      indexes.map((index) => index.indexname),
      [
        'idx_listings_active_created_at',
        'idx_listings_location',
        'idx_listings_location_geography',
      ],
    );
  });

  void it('chi tra tin active va loai tru tin da soft-delete', async () => {
    const expectedRows = await dataSource.query<CountRow[]>(`
      SELECT COUNT(*)::text AS count
      FROM listings
      WHERE status = 'active' AND deleted_at IS NULL
    `);
    const result = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), { limit: 50 }),
    );

    assert.equal(result.pagination.total, Number(expectedRows[0]?.count ?? 0));
    assert.ok(result.items.every((item) => item.status === 'active'));
  });

  void it('tim keyword khong phan biet dau va chu hoa', async () => {
    const keywordRows = await dataSource.query<KeywordRow[]>(`
      SELECT title
      FROM listings
      WHERE status = 'active'
        AND deleted_at IS NULL
        AND unaccent(title) ILIKE '%BACH KHOA%'
      LIMIT 1
    `);

    if (keywordRows.length === 0) return;

    const result = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), { keyword: 'BACH KHOA' }),
    );

    assert.ok(result.pagination.total > 0);
  });

  void it('loc theo gia, dien tich va loai phong dung bien', async () => {
    const price = Number(fixture.price);
    const area = Number(fixture.area);
    const roomType = DATABASE_TO_API_ROOM_TYPE[fixture.roomType];

    assert.ok(roomType, `Chua co mapping cho room type ${fixture.roomType}`);

    const result = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), {
        minPrice: price,
        maxPrice: price,
        minArea: area,
        maxArea: area,
        roomTypes: [roomType],
        limit: 50,
      }),
    );

    assert.ok(result.items.some((item) => item.id === fixture.id));
    assert.ok(
      result.items.every((item) => item.price === price && item.area === area),
    );
  });

  void it('loc tien ich theo ngu nghia AND', async () => {
    const amenityRows = await dataSource.query<AmenityRow[]>(`
      SELECT listing_id AS id, ARRAY_AGG(amenity_id ORDER BY amenity_id) AS amenities
      FROM listing_amenities
      GROUP BY listing_id
      HAVING COUNT(*) >= 2
      LIMIT 1
    `);

    if (amenityRows.length === 0) return;

    const amenityIds = amenityRows[0].amenities.slice(0, 2).map(Number);
    const result = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), {
        amenities: amenityIds,
        limit: 50,
      }),
    );

    assert.ok(
      result.items.every((item) =>
        amenityIds.every((amenityId) => item.amenityIds.includes(amenityId)),
      ),
    );
  });

  void it('dung ST_DWithin, tinh distance bang met va dung thu tu toa do', async () => {
    const result = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), {
        latitude: Number(fixture.latitude),
        longitude: Number(fixture.longitude),
        radius: 0.1,
        sortBy: 'distance',
        limit: 50,
      }),
    );
    const exactListing = result.items.find((item) => item.id === fixture.id);

    assert.ok(exactListing);
    assert.equal(exactListing.distanceMeters, 0);
    assert.ok(
      result.items.every(
        (item) =>
          typeof item.distanceMeters === 'number' &&
          item.distanceMeters >= 0 &&
          item.distanceMeters <= 100,
      ),
    );
  });

  void it('sap xep distance tang dan', async () => {
    const result = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), {
        latitude: Number(fixture.latitude),
        longitude: Number(fixture.longitude),
        radius: 50,
        sortBy: 'distance',
        limit: 50,
      }),
    );

    for (let index = 1; index < result.items.length; index += 1) {
      const previousDistance = result.items[index - 1].distanceMeters ?? 0;
      const currentDistance = result.items[index].distanceMeters ?? 0;

      assert.ok(previousDistance <= currentDistance);
    }
  });

  void it('phan trang on dinh va khong lap id giua hai trang', async () => {
    const firstPage = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), { page: 1, limit: 10 }),
    );
    const secondPage = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), { page: 2, limit: 10 }),
    );
    const firstPageIds = new Set(firstPage.items.map((item) => item.id));

    assert.equal(firstPage.pagination.page, 1);
    assert.equal(secondPage.pagination.page, 2);
    assert.ok(secondPage.items.every((item) => !firstPageIds.has(item.id)));
  });

  void it('tra dung contract FE va empty state', async () => {
    const result = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), { limit: 1 }),
    );
    const item = result.items[0];

    assert.ok(item);
    assert.deepEqual(
      Object.keys(item).sort(),
      [
        'address',
        'amenityIds',
        'area',
        'capacity',
        'createdAt',
        'description',
        'distanceMeters',
        'id',
        'imageUrls',
        'isHighlighted',
        'isReserved',
        'location',
        'price',
        'roomType',
        'stats',
        'status',
        'thumbnail',
        'title',
      ].sort(),
    );
    assert.equal(typeof item.location.latitude, 'number');
    assert.equal(typeof item.location.longitude, 'number');

    const emptyResult = await searchService.search(
      Object.assign(new SearchListingsQueryDto(), {
        keyword: '__khong_co_tin_dang_nao_mang_tu_khoa_nay__',
      }),
    );

    assert.deepEqual(emptyResult.items, []);
    assert.equal(emptyResult.pagination.total, 0);
    assert.equal(emptyResult.pagination.totalPages, 0);
  });
});

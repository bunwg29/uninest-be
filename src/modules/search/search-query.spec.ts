import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchListingsQueryDto } from './dto';
import {
  SEARCH_REFERENCE_POINT_SQL,
  SEARCH_ROOM_TYPE_DATABASE_VALUES,
} from './search.constants';
import { normalizeSearchQuery } from './search.service';

void describe('SearchListingsQueryDto', () => {
  void it('chuan hoa danh sach loai phong va tien ich tu CSV', async () => {
    const query = plainToInstance(SearchListingsQueryDto, {
      roomTypes: 'phong_tro,studio,phong_tro',
      amenities: '6,7,6',
      page: '2',
      limit: '20',
    });
    const errors = await validate(query);

    assert.equal(errors.length, 0);
    assert.deepEqual(query.roomTypes, ['phong_tro', 'studio']);
    assert.deepEqual(query.amenities, [6, 7]);
    assert.equal(query.page, 2);
    assert.equal(query.limit, 20);
  });

  void it('tu choi toa do va ban kinh khong hop le', async () => {
    const query = plainToInstance(SearchListingsQueryDto, {
      latitude: '100',
      longitude: '200',
      radius: '0',
    });
    const errors = await validate(query);
    const invalidProperties = errors.map((error) => error.property).sort();

    assert.deepEqual(invalidProperties, ['latitude', 'longitude', 'radius']);
  });

  void it('tu choi gia tri sap xep va loai phong khong nam trong whitelist', async () => {
    const query = plainToInstance(SearchListingsQueryDto, {
      sortBy: 'price; DROP TABLE listings',
      roomTypes: 'khong_hop_le',
    });
    const errors = await validate(query);
    const invalidProperties = errors.map((error) => error.property).sort();

    assert.deepEqual(invalidProperties, ['roomTypes', 'sortBy']);
  });
});

void describe('normalizeSearchQuery', () => {
  const getErrorCode = (callback: () => unknown): string | undefined => {
    try {
      callback();
    } catch (error) {
      assert.ok(error instanceof BadRequestException);

      const response = error.getResponse() as { error?: string };

      return response.error;
    }

    return undefined;
  };

  void it('ap dung gia tri mac dinh va ban kinh 5 km khi co toa do', () => {
    const query = new SearchListingsQueryDto();

    query.latitude = 10.7723134;
    query.longitude = 106.6573365;

    const normalizedQuery = normalizeSearchQuery(query);

    assert.equal(normalizedQuery.page, 1);
    assert.equal(normalizedQuery.limit, 10);
    assert.equal(normalizedQuery.sortBy, 'newest');
    assert.equal(normalizedQuery.radiusKm, 5);
  });

  void it('tu choi khi thieu mot thanh phan toa do', () => {
    const query = new SearchListingsQueryDto();

    query.latitude = 10.7723134;

    assert.equal(
      getErrorCode(() => normalizeSearchQuery(query)),
      'INVALID_COORDINATES',
    );
  });

  void it('tu choi khoang gia va dien tich bi dao', () => {
    const priceQuery = new SearchListingsQueryDto();

    priceQuery.minPrice = 4_000_000;
    priceQuery.maxPrice = 2_000_000;

    const areaQuery = new SearchListingsQueryDto();

    areaQuery.minArea = 40;
    areaQuery.maxArea = 20;

    assert.equal(
      getErrorCode(() => normalizeSearchQuery(priceQuery)),
      'INVALID_PRICE_RANGE',
    );
    assert.equal(
      getErrorCode(() => normalizeSearchQuery(areaQuery)),
      'INVALID_AREA_RANGE',
    );
  });

  void it('tu choi sap xep khoang cach khi khong co toa do', () => {
    const query = new SearchListingsQueryDto();

    query.sortBy = 'distance';

    assert.equal(
      getErrorCode(() => normalizeSearchQuery(query)),
      'INVALID_COORDINATES',
    );
  });
});

void describe('quy uoc tim kiem khong gian va loai phong', () => {
  void it('luon tao Point theo thu tu longitude, latitude', () => {
    assert.match(
      SEARCH_REFERENCE_POINT_SQL,
      /ST_MakePoint\(:longitude, :latitude\)/,
    );
  });

  void it('anh xa loai phong cua ung dung sang du lieu cu', () => {
    assert.ok(
      SEARCH_ROOM_TYPE_DATABASE_VALUES.phong_tro.includes('phong_don_co_ban'),
    );
    assert.ok(SEARCH_ROOM_TYPE_DATABASE_VALUES.studio.includes('studio_mini'));
  });
});

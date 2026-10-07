import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
}));

jest.mock('@core/storage', () => ({ R2StorageService: class {} }));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('../src/modules/listings/services/listings.service', () => ({
  ListingsService: class {},
}));

import { ComparisonService } from '../src/modules/comparison/services/comparison.service';
import { MAX_COMPARISON_ITEMS } from '../src/modules/comparison/constants';
import { ListingStatus } from '../src/modules/listings/entities';

type StoredItem = { userId: string; listingId: string };

const createHarness = (
  initialItems: StoredItem[],
  listings: Record<string, { id: string; status: ListingStatus }>,
) => {
  const items = [...initialItems];
  const transactionalRepository = {
    existsBy: jest.fn(({ userId, listingId }: StoredItem) =>
      Promise.resolve(
        items.some(
          (item) => item.userId === userId && item.listingId === listingId,
        ),
      ),
    ),
    countBy: jest.fn(({ userId }: { userId: string }) =>
      Promise.resolve(items.filter((item) => item.userId === userId).length),
    ),
    insert: jest.fn((item: StoredItem) => {
      items.push(item);

      return Promise.resolve();
    }),
  };
  const manager = {
    query: jest.fn().mockResolvedValue([]),
    getRepository: jest.fn(() => transactionalRepository),
  };
  const dataSource = {
    transaction: jest.fn((callback: (m: unknown) => unknown) =>
      callback(manager),
    ),
  } as unknown as DataSource;
  const comparisonRepository = {
    find: jest.fn(({ where }: { where: { userId: string } }) =>
      Promise.resolve(
        items
          .filter((item) => item.userId === where.userId)
          .map((item, index) => ({
            ...item,
            createdAt: new Date(2026, 0, index + 1),
          })),
      ),
    ),
    delete: jest.fn((criteria: Partial<StoredItem>) => {
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const matches = Object.entries(criteria).every(
          ([key, value]) => items[index][key as keyof StoredItem] === value,
        );

        if (matches) {
          items.splice(index, 1);
        }
      }

      return Promise.resolve();
    }),
  } as unknown as Repository<never>;
  const listingRepository = {
    findOneBy: jest.fn(({ id }: { id: string }) =>
      Promise.resolve(listings[id] ?? null),
    ),
  } as unknown as Repository<never>;
  const listingsService = {
    getDetailsForComparison: jest.fn((_userId: string, ids: string[]) =>
      Promise.resolve(
        ids
          .filter((id) => listings[id])
          .map((id) => ({
            status: listings[id].status,
            isDeleted: false,
            detail: { id, title: `Phòng ${id}` },
          })),
      ),
    ),
  };
  const service = new ComparisonService(
    comparisonRepository,
    listingRepository,
    dataSource,
    listingsService as never,
  );

  return { service, items, manager, transactionalRepository, listingsService };
};

const activeListings = Object.fromEntries(
  ['a', 'b', 'c', 'd', 'e'].map((id) => [
    id,
    { id, status: ListingStatus.ACTIVE },
  ]),
);

describe('Danh sách so sánh phòng trên máy chủ', () => {
  it('thêm phòng đang hiển thị và khoá theo người dùng trong giao dịch', async () => {
    const { service, items, manager } = createHarness([], activeListings);

    await expect(service.addItem('user-1', 'a')).resolves.toEqual({
      listingId: 'a',
      added: true,
      count: 1,
      maxItems: MAX_COMPARISON_ITEMS,
    });
    expect(items).toEqual([{ userId: 'user-1', listingId: 'a' }]);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      ['comparison:user-1'],
    );
  });

  it('chặn phòng thứ 5 bằng thông báo tiếng Việt', async () => {
    const { service, items } = createHarness(
      ['a', 'b', 'c', 'd'].map((listingId) => ({
        userId: 'user-1',
        listingId,
      })),
      activeListings,
    );

    await expect(service.addItem('user-1', 'e')).rejects.toThrow(
      new ConflictException('Chỉ so sánh được tối đa 4 phòng'),
    );
    expect(items).toHaveLength(MAX_COMPARISON_ITEMS);
  });

  it('thêm trùng là idempotent kể cả khi danh sách đã đầy', async () => {
    const { service, transactionalRepository } = createHarness(
      ['a', 'b', 'c', 'd'].map((listingId) => ({
        userId: 'user-1',
        listingId,
      })),
      activeListings,
    );

    await expect(service.addItem('user-1', 'b')).resolves.toMatchObject({
      listingId: 'b',
      added: false,
      count: 4,
    });
    expect(transactionalRepository.insert).not.toHaveBeenCalled();
  });

  it('từ chối phòng không tồn tại và phòng không còn hiển thị', async () => {
    const { service, transactionalRepository } = createHarness([], {
      hidden: { id: 'hidden', status: ListingStatus.HIDDEN },
      rented: { id: 'rented', status: ListingStatus.RENTED },
    });

    await expect(service.addItem('user-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.addItem('user-1', 'hidden')).rejects.toThrow(
      'Tin đăng không còn hiển thị nên không thể so sánh',
    );
    await expect(service.addItem('user-1', 'rented')).rejects.toThrow(
      ConflictException,
    );
    expect(transactionalRepository.insert).not.toHaveBeenCalled();
  });

  it('đánh dấu phòng không còn hiển thị nhưng vẫn giữ trong danh sách theo thứ tự thêm', async () => {
    const { service } = createHarness(
      [
        { userId: 'user-1', listingId: 'a' },
        { userId: 'user-1', listingId: 'b' },
        { userId: 'user-1', listingId: 'c' },
      ],
      {
        a: { id: 'a', status: ListingStatus.ACTIVE },
        b: { id: 'b', status: ListingStatus.RENTED },
        c: { id: 'c', status: ListingStatus.HIDDEN },
      },
    );

    const result = await service.listItems('user-1');

    expect(result.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(
      result.items.map((item) => [item.isAvailable, item.unavailableReason]),
    ).toEqual([
      [true, null],
      [false, 'Phòng đã được cho thuê'],
      [false, 'Tin đăng đã bị ẩn'],
    ]);
    expect(result).toMatchObject({ count: 3, maxItems: MAX_COMPARISON_ITEMS });
  });

  it('chỉ đọc, xoá và dọn danh sách của chính người dùng', async () => {
    const { service, items, listingsService } = createHarness(
      [
        { userId: 'user-1', listingId: 'a' },
        { userId: 'user-2', listingId: 'a' },
        { userId: 'user-2', listingId: 'b' },
      ],
      activeListings,
    );

    const result = await service.listItems('user-1');

    expect(result.items.map((item) => item.id)).toEqual(['a']);
    expect(listingsService.getDetailsForComparison).toHaveBeenCalledWith(
      'user-1',
      ['a'],
    );

    await service.removeItem('user-1', 'b');
    expect(items).toHaveLength(3);

    await service.clearItems('user-1');
    expect(items).toEqual([
      { userId: 'user-2', listingId: 'a' },
      { userId: 'user-2', listingId: 'b' },
    ]);
  });
});

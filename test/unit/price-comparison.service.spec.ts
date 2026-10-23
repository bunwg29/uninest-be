import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { RoomType } from '@modules/listings/entities/room-type';
import { PriceAggregateAreaLevel } from '@modules/price-comparison/constants';
import { PriceAggregate } from '@modules/price-comparison/entities';
import { PriceComparisonService } from '@modules/price-comparison/services/price-comparison.service';

function createAggregate(sampleCount: number): PriceAggregate {
  return Object.assign(new PriceAggregate(), {
    id: 'aggregate-id',
    areaLevel: PriceAggregateAreaLevel.WARD,
    areaCode: '20194',
    area: 'Phường Hải Châu',
    provinceCode: '48',
    roomType: RoomType.PHONG_TRO,
    avgPrice: sampleCount >= 5 ? '3000000' : null,
    popularPriceMin: sampleCount >= 5 ? '2500000' : null,
    popularPriceMax: sampleCount >= 5 ? '3500000' : null,
    sampleCount,
    dataFrom: new Date('2026-10-01T00:00:00.000Z'),
    dataTo: new Date('2026-10-20T00:00:00.000Z'),
    computedAt: new Date('2026-10-20T00:00:00.000Z'),
  });
}

describe('PriceComparisonService', () => {
  it.each([1, 4])(
    'trả giá null và cảnh báo khi chỉ có %i mẫu',
    async (sampleCount) => {
      const repository = {
        findAndCount: jest
          .fn()
          .mockResolvedValue([[createAggregate(sampleCount)], 1]),
      } as unknown as Repository<PriceAggregate>;
      const service = new PriceComparisonService(repository);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items[0]).toMatchObject({
        avgPrice: null,
        popularPriceMin: null,
        popularPriceMax: null,
        sampleCount,
        warning: 'Dữ liệu chưa đủ để tham chiếu',
      });
    },
  );

  it('trả giá tổng hợp khi có đúng 5 mẫu', async () => {
    const repository = {
      findAndCount: jest.fn().mockResolvedValue([[createAggregate(5)], 1]),
    } as unknown as Repository<PriceAggregate>;
    const service = new PriceComparisonService(repository);

    const result = await service.findAll({
      page: 1,
      limit: 20,
      provinceCode: '48',
      wardCode: '20194',
      roomType: RoomType.PHONG_TRO,
    });

    expect(result.items[0]).toMatchObject({
      avgPrice: 3_000_000,
      popularPriceMin: 2_500_000,
      popularPriceMax: 3_500_000,
      warning: null,
      unit: 'VNĐ/tháng',
    });
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          areaLevel: PriceAggregateAreaLevel.WARD,
          areaCode: '20194',
          provinceCode: '48',
          roomType: RoomType.PHONG_TRO,
        },
      }),
    );
  });

  it('trả giá null và cảnh báo khi không có mẫu', async () => {
    const repository = {
      findAndCount: jest.fn().mockResolvedValue([[createAggregate(0)], 1]),
    } as unknown as Repository<PriceAggregate>;
    const service = new PriceComparisonService(repository);

    const result = await service.findAll({ page: 1, limit: 20 });

    expect(result.items[0]).toMatchObject({
      avgPrice: null,
      popularPriceMin: null,
      popularPriceMax: null,
      sampleCount: 0,
      warning: 'Dữ liệu chưa đủ để tham chiếu',
    });
  });
});

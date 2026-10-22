import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';
import { PriceAggregationService } from '@modules/price-comparison/services/price-aggregation.service';

type QueryResultShape = {
  records: unknown[];
};

function createQueryRunner() {
  const query = jest
    .fn<Promise<QueryResultShape>, [string, unknown[]?]>()
    .mockResolvedValueOnce({ records: [{ locked: true }] })
    .mockResolvedValueOnce({ records: [] })
    .mockResolvedValueOnce({ records: [{ id: 'one' }, { id: 'two' }] })
    .mockResolvedValueOnce({ records: [{ unlocked: true }] });

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    query,
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    isTransactionActive: false,
    isReleased: false,
  };
}

describe('PriceAggregationService', () => {
  it('tính AVG và P25-P75 trong một transaction có advisory lock', async () => {
    const queryRunner = createQueryRunner();
    const dataSource = {
      createQueryRunner: () => queryRunner as unknown as QueryRunner,
    } as DataSource;
    const configService = {
      get: jest.fn().mockReturnValue(true),
    } as unknown as ConfigService;
    const service = new PriceAggregationService(dataSource, configService);

    const affected = await service.aggregatePrices();

    expect(affected).toBe(2);
    expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.query.mock.calls[0][0]).toContain(
      'pg_try_advisory_lock',
    );
    expect(queryRunner.query.mock.calls[1][0]).toBe(
      'DELETE FROM price_aggregates',
    );
    expect(queryRunner.query.mock.calls[2][0]).toContain('AVG(v.price)');
    expect(queryRunner.query.mock.calls[2][0]).toContain(
      'percentile_cont(0.25)',
    );
    expect(queryRunner.query.mock.calls[2][0]).toContain(
      'percentile_cont(0.75)',
    );
    expect(queryRunner.query.mock.calls[2][0]).toContain('l.status = $1');
    expect(queryRunner.query.mock.calls[2][0]).toContain(
      'l.deleted_at IS NULL',
    );
  });

  it('xử lý đúng mảng records trả về trực tiếp từ PostgreSQL', async () => {
    const queryRunner = createQueryRunner();

    queryRunner.query.mockReset();
    queryRunner.query
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'one' }, { id: 'two' }])
      .mockResolvedValueOnce([{ unlocked: true }]);
    const dataSource = {
      createQueryRunner: () => queryRunner as unknown as QueryRunner,
    } as DataSource;
    const service = new PriceAggregationService(dataSource, {
      get: jest.fn(),
    } as unknown as ConfigService);

    await expect(service.aggregatePrices()).resolves.toBe(2);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('không chạy job khi instance khác đang giữ advisory lock', async () => {
    const queryRunner = createQueryRunner();

    queryRunner.query.mockReset();
    queryRunner.query
      .mockResolvedValueOnce({ records: [{ locked: false }] })
      .mockResolvedValueOnce({ records: [{ unlocked: false }] });
    const dataSource = {
      createQueryRunner: () => queryRunner as unknown as QueryRunner,
    } as DataSource;
    const service = new PriceAggregationService(dataSource, {
      get: jest.fn(),
    } as unknown as ConfigService);

    await expect(service.aggregatePrices()).resolves.toBe(0);
    expect(queryRunner.startTransaction).not.toHaveBeenCalled();
  });

  it('rollback khi cập nhật snapshot thất bại', async () => {
    const queryRunner = createQueryRunner();

    queryRunner.query.mockReset();
    queryRunner.query
      .mockResolvedValueOnce({ records: [{ locked: true }] })
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce({ records: [{ unlocked: true }] });
    Object.defineProperty(queryRunner, 'isTransactionActive', {
      get: () => true,
    });
    const dataSource = {
      createQueryRunner: () => queryRunner as unknown as QueryRunner,
    } as DataSource;
    const service = new PriceAggregationService(dataSource, {
      get: jest.fn(),
    } as unknown as ConfigService);

    await expect(service.aggregatePrices()).rejects.toThrow(
      'database unavailable',
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('không chạy cron khi cấu hình đã tắt', async () => {
    const queryRunner = createQueryRunner();
    const dataSource = {
      createQueryRunner: () => queryRunner as unknown as QueryRunner,
    } as DataSource;
    const service = new PriceAggregationService(dataSource, {
      get: jest.fn().mockReturnValue('false'),
    } as unknown as ConfigService);

    await expect(service.handleScheduledAggregation()).resolves.toBe(0);
    expect(queryRunner.connect).not.toHaveBeenCalled();
  });
});

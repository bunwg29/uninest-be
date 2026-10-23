import { jest } from '@jest/globals';
import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { createGlobalValidationPipe } from '@common';
import { PriceComparisonController } from '@modules/price-comparison/price-comparison.controller';
import { PriceComparisonService } from '@modules/price-comparison/services/price-comparison.service';

const findAll = jest.fn();

@Module({
  controllers: [PriceComparisonController],
  providers: [
    {
      provide: PriceComparisonService,
      useValue: { findAll },
    },
  ],
})
class PriceComparisonTestModule {}

describe('GET /price-comparison', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(PriceComparisonTestModule, {
      logger: false,
    });
    app.useGlobalPipes(createGlobalValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    findAll.mockReset();
  });

  it('đọc dữ liệu tổng hợp và phản hồi dưới 2 giây', async () => {
    findAll.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      hasMore: false,
    });
    const startedAt = performance.now();

    await request(app.getHttpServer())
      .get('/price-comparison')
      .query({ provinceCode: '48', roomType: 'phong_tro' })
      .expect(200);

    expect(performance.now() - startedAt).toBeLessThan(2_000);
    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        provinceCode: '48',
        roomType: 'phong_tro',
      }),
    );
  });

  it('từ chối roomType không hợp lệ', async () => {
    await request(app.getHttpServer())
      .get('/price-comparison')
      .query({ roomType: 'khong_hop_le' })
      .expect(400);
    expect(findAll).not.toHaveBeenCalled();
  });
});

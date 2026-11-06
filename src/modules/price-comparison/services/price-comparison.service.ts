import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { createPaginatedResult } from '@common/dtos';
import {
  PriceAggregateAreaLevel,
  PRICE_COMPARISON_DEFAULTS,
} from '../constants';
import { PriceComparisonQueryDto } from '../dtos';
import { PriceAggregate } from '../entities';

export type PriceComparisonItem = {
  areaLevel: PriceAggregateAreaLevel;
  areaCode: string;
  area: string;
  provinceCode: string;
  roomType: string;
  avgPrice: number | null;
  popularPriceMin: number | null;
  popularPriceMax: number | null;
  sampleCount: number;
  unit: string;
  dataFrom: Date;
  dataTo: Date;
  computedAt: Date;
  warning: string | null;
};

@Injectable()
export class PriceComparisonService {
  constructor(
    @InjectRepository(PriceAggregate)
    private readonly aggregateRepository: Repository<PriceAggregate>,
  ) {}

  async findAll(query: PriceComparisonQueryDto) {
    const where: FindOptionsWhere<PriceAggregate> = {};

    if (query.wardCode) {
      where.areaLevel = PriceAggregateAreaLevel.WARD;
      where.areaCode = query.wardCode;
    } else if (query.areaLevel) {
      where.areaLevel = query.areaLevel;
    }

    if (query.provinceCode) {
      where.provinceCode = query.provinceCode;
    }

    if (query.roomType) {
      where.roomType = query.roomType;
    }

    const [rows, total] = await this.aggregateRepository.findAndCount({
      where,
      order: { area: 'ASC', roomType: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const items = rows.map((row) => this.mapItem(row));

    return createPaginatedResult(items, total, query.page, query.limit);
  }

  private mapItem(row: PriceAggregate): PriceComparisonItem {
    const hasSufficientData =
      row.sampleCount >= PRICE_COMPARISON_DEFAULTS.MINIMUM_SAMPLE_COUNT;

    return {
      areaLevel: row.areaLevel,
      areaCode: row.areaCode,
      area: row.area,
      provinceCode: row.provinceCode,
      roomType: row.roomType,
      avgPrice: hasSufficientData ? Number(row.avgPrice) : null,
      popularPriceMin: hasSufficientData ? Number(row.popularPriceMin) : null,
      popularPriceMax: hasSufficientData ? Number(row.popularPriceMax) : null,
      sampleCount: row.sampleCount,
      unit: PRICE_COMPARISON_DEFAULTS.UNIT,
      dataFrom: row.dataFrom,
      dataTo: row.dataTo,
      computedAt: row.computedAt,
      warning: hasSufficientData
        ? null
        : PRICE_COMPARISON_DEFAULTS.INSUFFICIENT_DATA_WARNING,
    };
  }
}

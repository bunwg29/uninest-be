import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const LANDLORD_STATS_PERIODS = ['7d', '30d', '90d', 'all'] as const;

export type LandlordStatsPeriod = (typeof LANDLORD_STATS_PERIODS)[number];

export const LANDLORD_STATS_PERIOD_DAYS: Record<
  Exclude<LandlordStatsPeriod, 'all'>,
  number
> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export class LandlordStatsQueryDto {
  @ApiPropertyOptional({
    description: 'Khoảng thời gian thống kê',
    enum: LANDLORD_STATS_PERIODS,
    default: '7d',
  })
  @IsOptional()
  @IsIn(LANDLORD_STATS_PERIODS, { message: 'Khoảng thời gian không hợp lệ' })
  period: LandlordStatsPeriod = '7d';
}

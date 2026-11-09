import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PREMIUM_STATS_PERIODS, type PremiumStatsPeriod } from '../constants';

export class PremiumStatsQueryDto {
  @ApiPropertyOptional({
    description: 'Khoảng thời gian thống kê',
    enum: PREMIUM_STATS_PERIODS,
    default: '30d',
  })
  @IsOptional()
  @IsIn(PREMIUM_STATS_PERIODS, { message: 'Khoảng thời gian không hợp lệ' })
  period: PremiumStatsPeriod = '30d';
}

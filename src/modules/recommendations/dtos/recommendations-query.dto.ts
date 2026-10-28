import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { RECOMMENDATION_DEFAULTS } from '../constants';

export class RecommendationsQueryDto {
  @ApiPropertyOptional({
    default: RECOMMENDATION_DEFAULTS.DEFAULT_LIMIT,
    maximum: RECOMMENDATION_DEFAULTS.MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng gợi ý phải là số nguyên' })
  @Min(1, { message: 'Số lượng gợi ý tối thiểu là 1' })
  @Max(RECOMMENDATION_DEFAULTS.MAX_LIMIT, {
    message: `Số lượng gợi ý tối đa là ${RECOMMENDATION_DEFAULTS.MAX_LIMIT}`,
  })
  limit: number = RECOMMENDATION_DEFAULTS.DEFAULT_LIMIT;
}

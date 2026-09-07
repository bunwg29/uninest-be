import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { PAGINATION_DEFAULTS } from '../constants';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    default: PAGINATION_DEFAULTS.DEFAULT_PAGE,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = PAGINATION_DEFAULTS.DEFAULT_PAGE;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: PAGINATION_DEFAULTS.DEFAULT_LIMIT,
    minimum: 1,
    maximum: PAGINATION_DEFAULTS.MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGINATION_DEFAULTS.MAX_LIMIT)
  limit: number = PAGINATION_DEFAULTS.DEFAULT_LIMIT;
}

export class PaginatedResultDto<T = unknown> {
  items!: T[];
  total!: number;
  page!: number;
  pageSize!: number;
  totalPages!: number;
  hasMore!: boolean;
}

export function createPaginatedResult<T>(
  items: T[],
  total: number,
  page: number = PAGINATION_DEFAULTS.DEFAULT_PAGE,
  limit: number = PAGINATION_DEFAULTS.DEFAULT_LIMIT,
): PaginatedResultDto<T> {
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.ceil(total / safeLimit);

  return {
    items,
    total,
    page,
    pageSize: safeLimit,
    totalPages,
    hasMore: page < totalPages,
  };
}

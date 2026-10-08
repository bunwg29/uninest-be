import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const UNIVERSITY_SEARCH_DEFAULT_LIMIT = 20;
export const UNIVERSITY_SEARCH_MAX_LIMIT = 50;

export class UniversitiesQueryDto {
  @ApiPropertyOptional({ description: 'Từ khoá tìm theo tên hoặc mã trường' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100, { message: 'Từ khoá tối đa 100 ký tự' })
  keyword?: string;

  @ApiPropertyOptional({ default: UNIVERSITY_SEARCH_DEFAULT_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(UNIVERSITY_SEARCH_MAX_LIMIT)
  limit: number = UNIVERSITY_SEARCH_DEFAULT_LIMIT;
}

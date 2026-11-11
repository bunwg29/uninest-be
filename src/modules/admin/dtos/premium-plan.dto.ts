import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const PREMIUM_PLAN_PRICE_LIMITS = {
  MIN: 1000,
  MAX: 100_000_000,
} as const;

export class UpdatePremiumPlanDto {
  @ApiPropertyOptional({ description: 'Tên gói hiển thị', maxLength: 60 })
  @IsOptional()
  @IsString({ message: 'Tên gói phải là chuỗi' })
  @MinLength(3, { message: 'Tên gói tối thiểu 3 ký tự' })
  @MaxLength(60, { message: 'Tên gói tối đa 60 ký tự' })
  name?: string;

  @ApiPropertyOptional({ description: 'Giá gói (VNĐ)' })
  @IsOptional()
  @IsInt({ message: 'Giá gói phải là số nguyên' })
  @Min(PREMIUM_PLAN_PRICE_LIMITS.MIN, {
    message: `Giá gói tối thiểu ${PREMIUM_PLAN_PRICE_LIMITS.MIN} VNĐ`,
  })
  @Max(PREMIUM_PLAN_PRICE_LIMITS.MAX, {
    message: `Giá gói tối đa ${PREMIUM_PLAN_PRICE_LIMITS.MAX} VNĐ`,
  })
  price?: number;

  @ApiPropertyOptional({ description: 'Bật hoặc tắt gói' })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái gói không hợp lệ' })
  isActive?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { LISTING_REPORT_REASONS } from '../entities/listing-report';

export class ReportListingDto {
  @ApiProperty({ enum: LISTING_REPORT_REASONS })
  @IsIn([...LISTING_REPORT_REASONS], { message: 'Lý do báo cáo không hợp lệ' })
  reason!: (typeof LISTING_REPORT_REASONS)[number];

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(500, { message: 'Ghi chú không được vượt quá 500 ký tự' })
  note?: string;
}

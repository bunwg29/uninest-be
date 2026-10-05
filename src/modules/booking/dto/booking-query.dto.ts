import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BookingStatus } from '../entities';

export class BookingSlotsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Mã phòng không hợp lệ' })
  listingId!: string;

  @ApiProperty({ example: '2026-09-12' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ngày phải có định dạng YYYY-MM-DD',
  })
  date!: string;
}

export class BookingListQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus, { message: 'Trạng thái lịch hẹn không hợp lệ' })
  status?: BookingStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên' })
  @Min(1, { message: 'Trang phải lớn hơn hoặc bằng 1' })
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @Type(() => Number)
  @IsInt({ message: 'Số bản ghi phải là số nguyên' })
  @Min(1, { message: 'Số bản ghi phải lớn hơn hoặc bằng 1' })
  @Max(50, { message: 'Chỉ được lấy tối đa 50 bản ghi' })
  limit: number = 20;
}

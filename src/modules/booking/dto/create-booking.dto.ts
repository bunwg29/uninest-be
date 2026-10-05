import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Mã phòng không hợp lệ' })
  listingId!: string;

  @ApiProperty({ example: '2026-09-12T15:00:00+07:00' })
  @IsDateString({}, { message: 'Thời gian xem phòng không hợp lệ' })
  startTime!: string;

  @ApiProperty({ example: '0905123456' })
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @Length(10, 10, { message: 'Số điện thoại phải có đúng 10 chữ số' })
  @Matches(/^0\d{9}$/, { message: 'Số điện thoại Việt Nam không hợp lệ' })
  phone!: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(300, { message: 'Ghi chú không được vượt quá 300 ký tự' })
  note?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { RoomType } from '@modules/listings/entities/room-type';
import { RECOMMENDATION_DEFAULTS } from '../constants';

export class RecordSearchBehaviorDto {
  @ApiPropertyOptional({ example: 'Hoà Khánh' })
  @IsOptional()
  @IsString({ message: 'Từ khoá phải là chuỗi' })
  @MaxLength(RECOMMENDATION_DEFAULTS.KEYWORD_MAX_LENGTH, {
    message: `Từ khoá tối đa ${RECOMMENDATION_DEFAULTS.KEYWORD_MAX_LENGTH} ký tự`,
  })
  keyword?: string;

  @ApiPropertyOptional({ example: 1500000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giá tối thiểu phải là số nguyên' })
  @Min(0, { message: 'Giá tối thiểu không được âm' })
  minPrice?: number;

  @ApiPropertyOptional({ example: 2500000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Giá tối đa phải là số nguyên' })
  @Min(1, { message: 'Giá tối đa phải lớn hơn 0' })
  maxPrice?: number;

  @ApiPropertyOptional({ enum: RoomType, isArray: true })
  @IsOptional()
  @IsArray({ message: 'Danh sách loại phòng không hợp lệ' })
  @ArrayMaxSize(6, { message: 'Tối đa 6 loại phòng' })
  @IsEnum(RoomType, { each: true, message: 'Loại phòng không hợp lệ' })
  roomTypes?: RoomType[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray({ message: 'Danh sách tiện ích không hợp lệ' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 tiện ích' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mã tiện ích phải là số nguyên' })
  amenities?: number[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray({ message: 'Danh sách trường không hợp lệ' })
  @ArrayMaxSize(5, { message: 'Tối đa 5 trường' })
  @IsString({ each: true, message: 'Mã trường không hợp lệ' })
  universityCodes?: string[];
}

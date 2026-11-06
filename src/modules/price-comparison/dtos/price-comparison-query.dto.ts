import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@common/dtos';
import { RoomType } from '@modules/listings/entities/room-type';
import { PriceAggregateAreaLevel } from '../constants';

export class PriceComparisonQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PriceAggregateAreaLevel })
  @IsOptional()
  @IsEnum(PriceAggregateAreaLevel, {
    message: 'Cấp khu vực không hợp lệ',
  })
  areaLevel?: PriceAggregateAreaLevel;

  @ApiPropertyOptional({ description: 'Mã tỉnh/thành phố' })
  @IsOptional()
  @IsString({ message: 'Mã tỉnh/thành phố phải là chuỗi' })
  @MaxLength(20, { message: 'Mã tỉnh/thành phố tối đa 20 ký tự' })
  provinceCode?: string;

  @ApiPropertyOptional({ description: 'Mã phường/xã' })
  @IsOptional()
  @IsString({ message: 'Mã phường/xã phải là chuỗi' })
  @MaxLength(20, { message: 'Mã phường/xã tối đa 20 ký tự' })
  wardCode?: string;

  @ApiPropertyOptional({ enum: RoomType })
  @IsOptional()
  @IsEnum(RoomType, { message: 'Loại phòng không hợp lệ' })
  roomType?: RoomType;
}

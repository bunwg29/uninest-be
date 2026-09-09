import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateListingImageDto {
  @ApiProperty({
    example: 'https://cdn.uninest.vn/listings/phong-1.jpg',
    description: 'URL ảnh đã upload lên Cloudflare R2',
  })
  @IsNotEmpty({ message: 'URL ảnh không được để trống' })
  @IsUrl({}, { message: 'URL ảnh không hợp lệ' })
  @MaxLength(1000, { message: 'URL ảnh tối đa 1000 ký tự' })
  url!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Đánh dấu ảnh bìa của tin đăng',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  isCover?: boolean;
}

export class CreateListingDto {
  @ApiProperty({
    example: 'Phòng trọ gần Đại học Bách Khoa',
    description: 'Tiêu đề tin đăng',
  })
  @IsNotEmpty({ message: 'Tiêu đề tin đăng không được để trống' })
  @IsString({ message: 'Tiêu đề tin đăng phải là chuỗi' })
  @MaxLength(150, { message: 'Tiêu đề tin đăng tối đa 150 ký tự' })
  title!: string;

  @ApiPropertyOptional({
    example: 'Phòng sạch sẽ, giờ giấc tự do, khu vực an ninh.',
    description: 'Mô tả chi tiết phòng trọ',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  @MaxLength(3000, { message: 'Mô tả tối đa 3000 ký tự' })
  description?: string;

  @ApiProperty({
    example: 'phong_tro',
    description: 'Loại hình phòng/trọ',
  })
  @IsNotEmpty({ message: 'Loại hình phòng/trọ không được để trống' })
  @IsString({ message: 'Loại hình phòng/trọ phải là chuỗi' })
  @MaxLength(50, { message: 'Loại hình phòng/trọ tối đa 50 ký tự' })
  roomType!: string;

  @ApiProperty({
    example: 2500000,
    description: 'Giá thuê hàng tháng',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá thuê phải là số' })
  @Min(1, { message: 'Giá thuê phải lớn hơn 0' })
  price!: number;

  @ApiProperty({
    example: 24.5,
    description: 'Diện tích phòng theo mét vuông',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Diện tích phải là số' })
  @Min(1, { message: 'Diện tích phải lớn hơn 0' })
  area!: number;

  @ApiProperty({
    example: 2,
    description: 'Số người ở tối đa',
  })
  @Type(() => Number)
  @IsInt({ message: 'Số người ở tối đa phải là số nguyên' })
  @Min(1, { message: 'Số người ở tối đa phải lớn hơn 0' })
  @Max(20, { message: 'Số người ở tối đa không được vượt quá 20' })
  maxOccupants!: number;

  @ApiPropertyOptional({
    example: 4000,
    description: 'Giá điện',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá điện phải là số' })
  @Min(0, { message: 'Giá điện không được âm' })
  electricPrice?: number;

  @ApiPropertyOptional({
    example: 100000,
    description: 'Giá nước',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá nước phải là số' })
  @Min(0, { message: 'Giá nước không được âm' })
  waterPrice?: number;

  @ApiPropertyOptional({
    example: 2500000,
    description: 'Tiền cọc',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tiền cọc phải là số' })
  @Min(0, { message: 'Tiền cọc không được âm' })
  deposit?: number;

  @ApiProperty({
    example: 'Số 12, đường Lý Thường Kiệt',
    description: 'Địa chỉ chi tiết',
  })
  @IsNotEmpty({ message: 'Địa chỉ chi tiết không được để trống' })
  @IsString({ message: 'Địa chỉ chi tiết phải là chuỗi' })
  @MaxLength(255, { message: 'Địa chỉ chi tiết tối đa 255 ký tự' })
  streetAddress!: string;

  @ApiProperty({
    example: '79',
    description: 'Mã tỉnh/thành phố',
  })
  @IsNotEmpty({ message: 'Mã tỉnh/thành phố không được để trống' })
  @IsString({ message: 'Mã tỉnh/thành phố phải là chuỗi' })
  @MaxLength(20, { message: 'Mã tỉnh/thành phố tối đa 20 ký tự' })
  provinceCode!: string;

  @ApiProperty({
    example: '26734',
    description: 'Mã phường/xã',
  })
  @IsNotEmpty({ message: 'Mã phường/xã không được để trống' })
  @IsString({ message: 'Mã phường/xã phải là chuỗi' })
  @MaxLength(20, { message: 'Mã phường/xã tối đa 20 ký tự' })
  wardCode!: string;

  @ApiProperty({
    example: 10.7721,
    description: 'Vĩ độ vị trí thực tế',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Vĩ độ phải là số' })
  @Min(-90, { message: 'Vĩ độ phải nằm trong khoảng -90 đến 90' })
  @Max(90, { message: 'Vĩ độ phải nằm trong khoảng -90 đến 90' })
  latitude!: number;

  @ApiProperty({
    example: 106.6579,
    description: 'Kinh độ vị trí thực tế',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Kinh độ phải là số' })
  @Min(-180, { message: 'Kinh độ phải nằm trong khoảng -180 đến 180' })
  @Max(180, { message: 'Kinh độ phải nằm trong khoảng -180 đến 180' })
  longitude!: number;

  @ApiPropertyOptional({
    type: [CreateListingImageDto],
    description:
      'Danh sách ảnh phòng đã upload lên Cloudflare R2, tối đa 10 ảnh',
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách ảnh phải là mảng' })
  @ArrayMaxSize(10, { message: 'Chỉ được chọn tối đa 10 ảnh' })
  @ValidateNested({ each: true })
  @Type(() => CreateListingImageDto)
  images?: CreateListingImageDto[];

  @ApiPropertyOptional({
    example: ['6d7f67b1-8f0b-4b72-bb15-9ac4c69d1c0d'],
    description: 'Danh sách mã tiện ích',
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách tiện ích phải là mảng' })
  @IsUUID('4', {
    each: true,
    message: 'Mã tiện ích không hợp lệ',
  })
  amenityIds?: string[];
}

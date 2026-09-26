import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateListingImageDto {
  @ApiProperty({
    example: 'listings/1715800000000-uuid.jpg',
    description: 'Object key của ảnh sau khi đã tải lên storage',
  })
  @IsNotEmpty({ message: 'Object key ảnh không được để trống' })
  @IsString({ message: 'Object key ảnh phải là chuỗi' })
  @Matches(
    /^(?!.*\.\.)(?!.*\/\/)listings\/[A-Za-z0-9][A-Za-z0-9._/-]*[A-Za-z0-9]$/,
    {
      message: 'Object key ảnh tin đăng không hợp lệ',
    },
  )
  @MaxLength(1000, { message: 'Object key ảnh tối đa 1000 ký tự' })
  key!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Đánh dấu ảnh bìa của tin đăng',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  isCover?: boolean;
}

export class ViewingSlotDto {
  @ApiProperty({ example: true, description: 'Có thể xem phòng vào buổi sáng' })
  @IsBoolean({ message: 'Trạng thái buổi sáng phải là kiểu boolean' })
  morning!: boolean;

  @ApiProperty({
    example: false,
    description: 'Có thể xem phòng vào buổi chiều',
  })
  @IsBoolean({ message: 'Trạng thái buổi chiều phải là kiểu boolean' })
  afternoon!: boolean;

  @ApiProperty({ example: true, description: 'Có thể xem phòng vào buổi tối' })
  @IsBoolean({ message: 'Trạng thái buổi tối phải là kiểu boolean' })
  evening!: boolean;
}

export class ViewingScheduleDto {
  @ApiProperty({ type: ViewingSlotDto, description: 'Lịch xem phòng thứ Hai' })
  @ValidateNested()
  @Type(() => ViewingSlotDto)
  mon!: ViewingSlotDto;

  @ApiProperty({ type: ViewingSlotDto, description: 'Lịch xem phòng thứ Ba' })
  @ValidateNested()
  @Type(() => ViewingSlotDto)
  tue!: ViewingSlotDto;

  @ApiProperty({ type: ViewingSlotDto, description: 'Lịch xem phòng thứ Tư' })
  @ValidateNested()
  @Type(() => ViewingSlotDto)
  wed!: ViewingSlotDto;

  @ApiProperty({ type: ViewingSlotDto, description: 'Lịch xem phòng thứ Năm' })
  @ValidateNested()
  @Type(() => ViewingSlotDto)
  thu!: ViewingSlotDto;

  @ApiProperty({ type: ViewingSlotDto, description: 'Lịch xem phòng thứ Sáu' })
  @ValidateNested()
  @Type(() => ViewingSlotDto)
  fri!: ViewingSlotDto;

  @ApiProperty({ type: ViewingSlotDto, description: 'Lịch xem phòng thứ Bảy' })
  @ValidateNested()
  @Type(() => ViewingSlotDto)
  sat!: ViewingSlotDto;

  @ApiProperty({ type: ViewingSlotDto, description: 'Lịch xem phòng Chủ nhật' })
  @ValidateNested()
  @Type(() => ViewingSlotDto)
  sun!: ViewingSlotDto;
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
    description: 'Danh sách object key của ảnh phòng đã tải lên, tối đa 10 ảnh',
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách ảnh phải là mảng' })
  @ArrayMaxSize(10, { message: 'Chỉ được chọn tối đa 10 ảnh' })
  @ValidateNested({ each: true })
  @Type(() => CreateListingImageDto)
  images?: CreateListingImageDto[];

  @ApiPropertyOptional({
    example: [1, 2, 3],
    description: 'Danh sách mã định danh tiện ích dạng số',
    type: [Number],
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách tiện ích phải là mảng' })
  @IsInt({ each: true, message: 'Mã tiện ích phải là số nguyên' })
  @Min(0, { each: true, message: 'Mã tiện ích không được là số âm' })
  @Type(() => Number)
  amenityIds?: number[];

  @ApiPropertyOptional({
    type: ViewingScheduleDto,
    description: 'Lịch cho xem phòng định kỳ trong tuần',
    example: {
      mon: { morning: true, afternoon: false, evening: true },
      tue: { morning: false, afternoon: true, evening: false },
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ViewingScheduleDto)
  viewingSchedule?: ViewingScheduleDto;
}

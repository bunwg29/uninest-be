import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmpty,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';
import {
  SEARCH_DEFAULTS,
  SEARCH_ROOM_TYPE_VALUES,
  SEARCH_SORT_VALUES,
} from '../search.constants';
import type { SearchRoomType, SearchSort } from '../search.constants';

const normalizeCsvValues = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;

  const values = Array.isArray(value) ? value : [value];
  const normalizedValues = values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  return normalizedValues.length > 0
    ? [...new Set(normalizedValues)]
    : undefined;
};

const normalizeCsvNumbers = (value: unknown): number[] | undefined => {
  const normalizedValues = normalizeCsvValues(value);

  return normalizedValues?.map((item) => Number(item));
};

export class SearchListingsQueryDto {
  @ApiHideProperty()
  @IsEmpty({ message: 'Không được phép lọc theo trạng thái tin đăng' })
  status?: never;

  @ApiPropertyOptional({
    description: 'Từ khoá tìm theo tiêu đề hoặc địa chỉ',
    maxLength: SEARCH_DEFAULTS.MAX_KEYWORD_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi' })
  @MaxLength(SEARCH_DEFAULTS.MAX_KEYWORD_LENGTH, {
    message: `Từ khoá tìm kiếm không được vượt quá ${SEARCH_DEFAULTS.MAX_KEYWORD_LENGTH} ký tự`,
  })
  keyword?: string;

  @ApiPropertyOptional({ minimum: 0, description: 'Giá thuê tối thiểu' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá tối thiểu phải là số' })
  @Min(0, { message: 'Giá tối thiểu không được âm' })
  minPrice?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Giá thuê tối đa' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá tối đa phải là số' })
  @Min(0, { message: 'Giá tối đa không được âm' })
  maxPrice?: number;

  @ApiPropertyOptional({
    minimum: 0.01,
    description: 'Diện tích tối thiểu theo mét vuông',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Diện tích tối thiểu phải là số' })
  @Min(0.01, { message: 'Diện tích tối thiểu phải lớn hơn 0' })
  minArea?: number;

  @ApiPropertyOptional({
    minimum: 0.01,
    description: 'Diện tích tối đa theo mét vuông',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Diện tích tối đa phải là số' })
  @Min(0.01, { message: 'Diện tích tối đa phải lớn hơn 0' })
  maxArea?: number;

  @ApiPropertyOptional({
    enum: SEARCH_ROOM_TYPE_VALUES,
    isArray: true,
    description: 'Danh sách loại phòng, phân tách bằng dấu phẩy',
    example: 'phong_tro,studio',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeCsvValues(value))
  @IsArray({ message: 'Danh sách loại phòng không hợp lệ' })
  @ArrayMaxSize(SEARCH_ROOM_TYPE_VALUES.length, {
    message: 'Danh sách loại phòng vượt quá giới hạn',
  })
  @IsIn(SEARCH_ROOM_TYPE_VALUES, {
    each: true,
    message: 'Loại phòng không hợp lệ',
  })
  roomTypes?: SearchRoomType[];

  @ApiPropertyOptional({
    type: String,
    description: 'Danh sách mã tiện ích, phân tách bằng dấu phẩy',
    example: '6,7,14',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizeCsvNumbers(value))
  @IsArray({ message: 'Danh sách tiện ích không hợp lệ' })
  @ArrayMaxSize(SEARCH_DEFAULTS.MAX_AMENITY_FILTERS, {
    message: 'Danh sách tiện ích vượt quá giới hạn',
  })
  @IsInt({ each: true, message: 'Mã tiện ích phải là số nguyên' })
  @Min(1, { each: true, message: 'Mã tiện ích phải lớn hơn 0' })
  amenities?: number[];

  @ApiPropertyOptional({
    minimum: -90,
    maximum: 90,
    description: 'Vĩ độ WGS 84',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Vĩ độ phải là số' })
  @Min(-90, { message: 'Vĩ độ phải từ -90 đến 90' })
  @Max(90, { message: 'Vĩ độ phải từ -90 đến 90' })
  latitude?: number;

  @ApiPropertyOptional({
    minimum: -180,
    maximum: 180,
    description: 'Kinh độ WGS 84',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Kinh độ phải là số' })
  @Min(-180, { message: 'Kinh độ phải từ -180 đến 180' })
  @Max(180, { message: 'Kinh độ phải từ -180 đến 180' })
  longitude?: number;

  @ApiPropertyOptional({
    minimum: 0.1,
    maximum: SEARCH_DEFAULTS.MAX_RADIUS_KM,
    default: SEARCH_DEFAULTS.RADIUS_KM,
    description: 'Bán kính tìm kiếm theo km khi có toạ độ',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Bán kính tìm kiếm phải là số' })
  @Min(0.1, { message: 'Bán kính tìm kiếm phải lớn hơn 0' })
  @Max(SEARCH_DEFAULTS.MAX_RADIUS_KM, {
    message: `Bán kính tìm kiếm không được vượt quá ${SEARCH_DEFAULTS.MAX_RADIUS_KM} km`,
  })
  radius?: number;

  @ApiPropertyOptional({
    description:
      'Chỉ lấy tin đăng gần ít nhất một trong các trường (mã trường, phân tách bằng dấu phẩy)',
    example: 'DDK,VKU',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    normalizeCsvValues(value)?.map((code) => code.toUpperCase()),
  )
  @IsArray({ message: 'Danh sách trường không hợp lệ' })
  @ArrayMaxSize(SEARCH_DEFAULTS.MAX_UNIVERSITY_FILTERS, {
    message: `Chỉ lọc tối đa ${SEARCH_DEFAULTS.MAX_UNIVERSITY_FILTERS} trường`,
  })
  @IsString({ each: true, message: 'Mã trường không hợp lệ' })
  @MaxLength(20, { each: true, message: 'Mã trường không hợp lệ' })
  universityCodes?: string[];

  @ApiPropertyOptional({
    description: 'Chỉ lấy các tin đăng của một chủ trọ',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Mã chủ trọ không hợp lệ' })
  ownerId?: string;

  @ApiPropertyOptional({
    enum: SEARCH_SORT_VALUES,
    default: 'newest',
    description: 'Cách sắp xếp kết quả',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'distance' ? 'nearest' : value,
  )
  @IsIn(SEARCH_SORT_VALUES, { message: 'Cách sắp xếp không hợp lệ' })
  sortBy: SearchSort = 'relevance';

  @ApiPropertyOptional({ minimum: 1, default: SEARCH_DEFAULTS.PAGE })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải bắt đầu từ 1' })
  page: number = SEARCH_DEFAULTS.PAGE;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: SEARCH_DEFAULTS.MAX_LIMIT,
    default: SEARCH_DEFAULTS.LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số kết quả mỗi trang phải là số nguyên' })
  @Min(1, { message: 'Số kết quả mỗi trang phải lớn hơn 0' })
  @Max(SEARCH_DEFAULTS.MAX_LIMIT, {
    message: `Số kết quả mỗi trang không được vượt quá ${SEARCH_DEFAULTS.MAX_LIMIT}`,
  })
  limit: number = SEARCH_DEFAULTS.LIMIT;
}

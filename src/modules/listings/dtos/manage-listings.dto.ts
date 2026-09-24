import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '@common/dtos';
import { ListingStatus } from '../entities';

const LANDLORD_VISIBILITY_STATUSES = {
  ACTIVE: ListingStatus.ACTIVE,
  HIDDEN: ListingStatus.HIDDEN,
} as const;

export const LANDLORD_LISTING_SORT_VALUES = [
  'newest',
  'oldest',
  'price_asc',
  'price_desc',
] as const;

export type LandlordListingSort = (typeof LANDLORD_LISTING_SORT_VALUES)[number];

const LANDLORD_LISTING_FILTER_STATUSES = [
  ...Object.values(ListingStatus),
  'deleted',
  'all',
] as const;

export class LandlordListingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: LANDLORD_LISTING_FILTER_STATUSES,
    description: 'Trạng thái tin đăng cần lọc',
  })
  @IsOptional()
  @IsIn(LANDLORD_LISTING_FILTER_STATUSES, {
    message: 'Trạng thái tin đăng không hợp lệ',
  })
  status?: ListingStatus | 'deleted' | 'all';

  @ApiPropertyOptional({ description: 'Từ khoá tìm theo tiêu đề hoặc địa chỉ' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi' })
  @MaxLength(100, { message: 'Từ khoá tìm kiếm không được vượt quá 100 ký tự' })
  keyword?: string;

  @ApiPropertyOptional({
    enum: LANDLORD_LISTING_SORT_VALUES,
    default: 'newest',
    description: 'Cách sắp xếp danh sách tin đăng',
  })
  @IsOptional()
  @IsIn(LANDLORD_LISTING_SORT_VALUES, { message: 'Cách sắp xếp không hợp lệ' })
  sortBy: LandlordListingSort = 'newest';
}

export class UpdateListingVisibilityDto {
  @ApiProperty({ description: 'Ẩn tin khi true, hiện tin khi false' })
  @IsBoolean({ message: 'Trạng thái ẩn phải là kiểu boolean' })
  hidden!: boolean;
}

export class UpdateListingStatusDto {
  @ApiProperty({
    enum: [ListingStatus.ACTIVE, ListingStatus.HIDDEN],
    description: 'Trạng thái hiển thị mới của tin đăng',
  })
  @IsEnum(LANDLORD_VISIBILITY_STATUSES, {
    message: 'Chủ trọ chỉ có thể chuyển tin sang đang hiển thị hoặc đã ẩn',
  })
  status!: ListingStatus.ACTIVE | ListingStatus.HIDDEN;
}

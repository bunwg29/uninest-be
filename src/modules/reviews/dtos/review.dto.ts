import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '@common/dtos';
import { REVIEW_LIMITS } from '../constants';

export class CreateReviewDto {
  @ApiProperty({ description: 'Mã lịch xem phòng đã hoàn thành' })
  @IsUUID('4', { message: 'Mã lịch xem phòng không hợp lệ' })
  bookingId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt({ message: 'Điểm vị trí phải là số nguyên' })
  @Min(REVIEW_LIMITS.MIN_RATING, { message: 'Điểm vị trí tối thiểu là 1' })
  @Max(REVIEW_LIMITS.MAX_RATING, { message: 'Điểm vị trí tối đa là 5' })
  locationRating!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt({ message: 'Điểm giá trị phải là số nguyên' })
  @Min(REVIEW_LIMITS.MIN_RATING, { message: 'Điểm giá trị tối thiểu là 1' })
  @Max(REVIEW_LIMITS.MAX_RATING, { message: 'Điểm giá trị tối đa là 5' })
  valueRating!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt({ message: 'Điểm thái độ chủ trọ phải là số nguyên' })
  @Min(REVIEW_LIMITS.MIN_RATING, {
    message: 'Điểm thái độ chủ trọ tối thiểu là 1',
  })
  @Max(REVIEW_LIMITS.MAX_RATING, {
    message: 'Điểm thái độ chủ trọ tối đa là 5',
  })
  landlordRating!: number;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt({ message: 'Điểm tiện ích phải là số nguyên' })
  @Min(REVIEW_LIMITS.MIN_RATING, { message: 'Điểm tiện ích tối thiểu là 1' })
  @Max(REVIEW_LIMITS.MAX_RATING, { message: 'Điểm tiện ích tối đa là 5' })
  amenitiesRating!: number;

  @ApiPropertyOptional({ maxLength: REVIEW_LIMITS.COMMENT_MAX_LENGTH })
  @IsOptional()
  @IsString({ message: 'Nhận xét phải là chuỗi' })
  @MaxLength(REVIEW_LIMITS.COMMENT_MAX_LENGTH, {
    message: 'Nhận xét tối đa 2000 ký tự',
  })
  comment?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'Xác nhận cảnh báo phải là kiểu đúng hoặc sai' })
  acknowledgeWarnings?: boolean;
}

export class UpdateReviewDto extends PartialType(
  OmitType(CreateReviewDto, ['bookingId'] as const),
) {}

export class ReviewListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số sao phải là số nguyên' })
  @Min(1, { message: 'Số sao tối thiểu là 1' })
  @Max(5, { message: 'Số sao tối đa là 5' })
  stars?: number;
}

export class ReplyReviewDto {
  @ApiProperty({ maxLength: REVIEW_LIMITS.REPLY_MAX_LENGTH })
  @IsString({ message: 'Phản hồi phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung phản hồi' })
  @MaxLength(REVIEW_LIMITS.REPLY_MAX_LENGTH, {
    message: 'Phản hồi tối đa 1000 ký tự',
  })
  content!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'Xác nhận cảnh báo phải là kiểu đúng hoặc sai' })
  acknowledgeWarnings?: boolean;
}

export class ReportReviewDto {
  @ApiProperty({ maxLength: 80 })
  @IsString({ message: 'Lý do báo cáo phải là chuỗi' })
  @IsNotEmpty({ message: 'Vui lòng nhập lý do báo cáo' })
  @MaxLength(80, { message: 'Lý do báo cáo tối đa 80 ký tự' })
  reason!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;
}

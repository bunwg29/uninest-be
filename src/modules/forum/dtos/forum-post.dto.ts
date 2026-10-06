import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '@common/dtos';
import { FORUM_CONSTANTS } from '../constants';
import {
  ForumCategory,
  ForumPostStatus,
  RoommateGender,
  RoommateStatus,
} from '../entities';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FORUM_IMAGE_KEY_PATTERN = new RegExp(
  `^${FORUM_CONSTANTS.IMAGE_KEY_PREFIX}[A-Za-z0-9/_.-]+$`,
);

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RoommateCriteriaDto {
  @ApiProperty({ enum: RoommateGender, description: 'Giới tính bạn ở ghép' })
  @IsEnum(RoommateGender, { message: 'Giới tính bạn ở ghép không hợp lệ' })
  gender!: RoommateGender;

  @ApiProperty({ example: 1300000, description: 'Chi phí mỗi người (VNĐ)' })
  @Type(() => Number)
  @IsInt({ message: 'Chi phí mỗi người phải là số nguyên' })
  @Min(0, { message: 'Chi phí mỗi người không được âm' })
  @Max(100_000_000, { message: 'Chi phí mỗi người vượt quá giới hạn cho phép' })
  costPerPerson!: number;

  @ApiPropertyOptional({ example: 'Điện nước chia đôi (~250k/tháng)' })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Ghi chú chi phí phải là chuỗi' })
  @MaxLength(200, { message: 'Ghi chú chi phí không được vượt quá 200 ký tự' })
  costNote?: string;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Ngày dọn vào' })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'Ngày dọn vào phải có định dạng YYYY-MM-DD',
  })
  moveInDate?: string;

  @ApiPropertyOptional({ example: 6, description: 'Thời gian ở tối thiểu' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số tháng ở tối thiểu phải là số nguyên' })
  @Min(1, { message: 'Số tháng ở tối thiểu phải lớn hơn 0' })
  @Max(60, { message: 'Số tháng ở tối thiểu không được vượt quá 60' })
  minStayMonths?: number;

  @ApiPropertyOptional({
    example: 'Không hút thuốc · Gọn gàng · Ngủ trước 12h',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Tiêu chí ở ghép phải là chuỗi' })
  @MaxLength(500, { message: 'Tiêu chí ở ghép không được vượt quá 500 ký tự' })
  lifestyle?: string;

  @ApiPropertyOptional({
    example: 'Kiệt 154 Nguyễn Lương Bằng, P. Hoà Khánh Bắc, Q. Liên Chiểu',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Khu vực phải là chuỗi' })
  @MaxLength(255, { message: 'Khu vực không được vượt quá 255 ký tự' })
  area?: string;
}

export class CreateForumPostDto {
  @ApiProperty({ enum: ForumCategory, description: 'Chuyên mục bài viết' })
  @IsEnum(ForumCategory, { message: 'Chuyên mục bài viết không hợp lệ' })
  category!: ForumCategory;

  @ApiProperty({
    example: 'Tìm 1 bạn nữ ở ghép Hoà Khánh Bắc, 1,3 triệu/người',
  })
  @Transform(trimString)
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @MinLength(5, { message: 'Tiêu đề phải có ít nhất 5 ký tự' })
  @MaxLength(FORUM_CONSTANTS.TITLE_MAX_LENGTH, {
    message: `Tiêu đề không được vượt quá ${FORUM_CONSTANTS.TITLE_MAX_LENGTH} ký tự`,
  })
  title!: string;

  @ApiProperty({ example: 'Mình đang thuê phòng 24 m² có gác ở kiệt 154...' })
  @Transform(trimString)
  @IsString({ message: 'Nội dung phải là chuỗi' })
  @MinLength(10, { message: 'Nội dung phải có ít nhất 10 ký tự' })
  @MaxLength(FORUM_CONSTANTS.CONTENT_MAX_LENGTH, {
    message: `Nội dung không được vượt quá ${FORUM_CONSTANTS.CONTENT_MAX_LENGTH} ký tự`,
  })
  content!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['forum/1730000000000-uuid.jpg'],
    description: 'Object key ảnh đã upload lên R2 (thư mục forum)',
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách ảnh phải là mảng' })
  @ArrayMaxSize(FORUM_CONSTANTS.MAX_IMAGES_PER_POST, {
    message: `Bài viết chỉ được có tối đa ${FORUM_CONSTANTS.MAX_IMAGES_PER_POST} ảnh`,
  })
  @IsString({ each: true, message: 'Object key ảnh phải là chuỗi' })
  @Matches(FORUM_IMAGE_KEY_PATTERN, {
    each: true,
    message: 'Ảnh bài viết phải được upload vào thư mục forum',
  })
  imageKeys?: string[];

  @ApiPropertyOptional({
    type: RoommateCriteriaDto,
    description: 'Bắt buộc với chuyên mục Tìm bạn ở ghép',
  })
  @ValidateIf(
    (dto: CreateForumPostDto) =>
      dto.category === ForumCategory.ROOMMATE || dto.roommate !== undefined,
  )
  @IsDefined({ message: 'Bài tìm bạn ở ghép phải có tiêu chí ở ghép' })
  @ValidateNested()
  @Type(() => RoommateCriteriaDto)
  roommate?: RoommateCriteriaDto;

  @ApiPropertyOptional({
    enum: RoommateStatus,
    description: 'Trạng thái còn chỗ / đã đủ của bài ở ghép',
  })
  @IsOptional()
  @IsEnum(RoommateStatus, { message: 'Trạng thái ở ghép không hợp lệ' })
  roommateStatus?: RoommateStatus;

  @ApiPropertyOptional({
    default: false,
    description: 'Lưu nháp thay vì đăng ngay',
  })
  @IsOptional()
  @IsBoolean({ message: 'Cờ lưu nháp phải là kiểu boolean' })
  isDraft?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Xác nhận vẫn đăng dù nội dung có cảnh báo (không áp dụng cho nội dung bị chặn)',
  })
  @IsOptional()
  @IsBoolean({ message: 'Cờ xác nhận cảnh báo phải là kiểu boolean' })
  acknowledgeWarnings?: boolean;
}

export class UpdateForumPostDto extends PartialType(CreateForumPostDto) {}

export const FORUM_POST_SORT_VALUES = ['newest', 'popular'] as const;

export type ForumPostSort = (typeof FORUM_POST_SORT_VALUES)[number];

export class ForumPostsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ForumCategory })
  @IsOptional()
  @IsEnum(ForumCategory, { message: 'Chuyên mục bài viết không hợp lệ' })
  category?: ForumCategory;

  @ApiPropertyOptional({ description: 'Từ khoá tìm theo tiêu đề, nội dung' })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi' })
  @MaxLength(100, { message: 'Từ khoá tìm kiếm không được vượt quá 100 ký tự' })
  keyword?: string;

  @ApiPropertyOptional({
    enum: RoommateGender,
    description: 'Lọc bài ở ghép theo giới tính (gồm cả bài không yêu cầu)',
  })
  @IsOptional()
  @IsEnum(RoommateGender, { message: 'Giới tính bạn ở ghép không hợp lệ' })
  gender?: RoommateGender;

  @ApiPropertyOptional({ example: 1500000, description: 'Chi phí tối đa' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Chi phí tối đa phải là số nguyên' })
  @Min(0, { message: 'Chi phí tối đa không được âm' })
  maxCost?: number;

  @ApiPropertyOptional({ example: 'Liên Chiểu', description: 'Khu vực' })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Khu vực phải là chuỗi' })
  @MaxLength(100, { message: 'Khu vực không được vượt quá 100 ký tự' })
  area?: string;

  @ApiPropertyOptional({ enum: RoommateStatus })
  @IsOptional()
  @IsEnum(RoommateStatus, { message: 'Trạng thái ở ghép không hợp lệ' })
  roommateStatus?: RoommateStatus;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Chỉ lấy bài có ngày dọn vào trước hoặc bằng ngày này',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'Ngày dọn vào phải có định dạng YYYY-MM-DD',
  })
  moveInBefore?: string;

  @ApiPropertyOptional({ enum: FORUM_POST_SORT_VALUES, default: 'newest' })
  @IsOptional()
  @IsIn(FORUM_POST_SORT_VALUES, { message: 'Cách sắp xếp không hợp lệ' })
  sortBy: ForumPostSort = 'newest';
}

export class MyForumPostsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ForumPostStatus })
  @IsOptional()
  @IsEnum(ForumPostStatus, { message: 'Trạng thái bài viết không hợp lệ' })
  status?: ForumPostStatus;
}

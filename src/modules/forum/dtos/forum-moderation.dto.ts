import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '@common/dtos';
import { FORUM_CONSTANTS } from '../constants';
import {
  ForumCategory,
  ForumPostStatus,
  ForumReportTargetType,
  ModerationAction,
} from '../entities';
import { trimString } from './forum-post.dto';

export class ModerationRoommateTextDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Ghi chú chi phí phải là chuỗi' })
  @MaxLength(200, { message: 'Ghi chú chi phí không được vượt quá 200 ký tự' })
  costNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Tiêu chí ở ghép phải là chuỗi' })
  @MaxLength(500, { message: 'Tiêu chí ở ghép không được vượt quá 500 ký tự' })
  lifestyle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Khu vực phải là chuỗi' })
  @MaxLength(255, { message: 'Khu vực không được vượt quá 255 ký tự' })
  area?: string;
}

export class CheckForumContentDto {
  @ApiPropertyOptional({ example: 'Tìm bạn ở ghép, liên hệ 0905 123 456' })
  @IsOptional()
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @MaxLength(FORUM_CONSTANTS.TITLE_MAX_LENGTH, {
    message: `Tiêu đề không được vượt quá ${FORUM_CONSTANTS.TITLE_MAX_LENGTH} ký tự`,
  })
  title?: string;

  @ApiPropertyOptional({ example: 'Chuyển khoản cọc vào STK 0123456789' })
  @IsOptional()
  @IsString({ message: 'Nội dung phải là chuỗi' })
  @MaxLength(FORUM_CONSTANTS.CONTENT_MAX_LENGTH, {
    message: `Nội dung không được vượt quá ${FORUM_CONSTANTS.CONTENT_MAX_LENGTH} ký tự`,
  })
  content?: string;

  @ApiPropertyOptional({ type: ModerationRoommateTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ModerationRoommateTextDto)
  roommate?: ModerationRoommateTextDto;
}

export const ADMIN_MODERATION_DECISIONS = ['restore', 'remove'] as const;

export type AdminModerationDecision =
  (typeof ADMIN_MODERATION_DECISIONS)[number];

export class ModerateForumContentDto {
  @ApiProperty({
    enum: ADMIN_MODERATION_DECISIONS,
    description: 'restore: hiển thị lại, remove: xoá mềm nội dung',
  })
  @IsIn(ADMIN_MODERATION_DECISIONS, {
    message: 'Quyết định xử lý chỉ được là restore hoặc remove',
  })
  decision!: AdminModerationDecision;
}

export class AdminForumPostsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ForumPostStatus,
    default: ForumPostStatus.HIDDEN,
  })
  @IsOptional()
  @IsEnum(ForumPostStatus, { message: 'Trạng thái bài viết không hợp lệ' })
  status: ForumPostStatus = ForumPostStatus.HIDDEN;

  @ApiPropertyOptional({ enum: ForumCategory })
  @IsOptional()
  @IsEnum(ForumCategory, { message: 'Chuyên mục bài viết không hợp lệ' })
  category?: ForumCategory;
}

export class AdminForumReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ForumReportTargetType })
  @IsOptional()
  @IsEnum(ForumReportTargetType, {
    message: 'Loại nội dung bị báo cáo không hợp lệ',
  })
  targetType?: ForumReportTargetType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => {
    const rawValue = obj.isResolved;

    return rawValue === 'true' ? true : rawValue === 'false' ? false : rawValue;
  })
  @IsBoolean({ message: 'Trạng thái xử lý phải là kiểu boolean' })
  isResolved?: boolean;
}

export class CreateBannedKeywordDto {
  @ApiProperty({ example: 'vcl' })
  @Transform(trimString)
  @IsString({ message: 'Từ khoá phải là chuỗi' })
  @MinLength(2, { message: 'Từ khoá phải có ít nhất 2 ký tự' })
  @MaxLength(100, { message: 'Từ khoá không được vượt quá 100 ký tự' })
  keyword!: string;

  @ApiPropertyOptional({
    enum: ModerationAction,
    default: ModerationAction.BLOCK,
  })
  @IsOptional()
  @IsEnum(ModerationAction, {
    message: 'Hành động xử lý từ khoá chỉ được là warn hoặc block',
  })
  action?: ModerationAction;
}

export class UpdateBannedKeywordDto extends PartialType(
  CreateBannedKeywordDto,
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái kích hoạt phải là kiểu boolean' })
  isActive?: boolean;
}

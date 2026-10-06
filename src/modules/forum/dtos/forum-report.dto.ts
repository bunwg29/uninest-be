import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FORUM_CONSTANTS } from '../constants';
import { ForumReportReason } from '../entities';
import { trimString } from './forum-post.dto';

export class CreateForumReportDto {
  @ApiProperty({ enum: ForumReportReason, description: 'Lý do báo cáo' })
  @IsEnum(ForumReportReason, { message: 'Lý do báo cáo không hợp lệ' })
  reason!: ForumReportReason;

  @ApiPropertyOptional({ description: 'Mô tả thêm cho lý do báo cáo' })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Ghi chú báo cáo phải là chuỗi' })
  @MaxLength(FORUM_CONSTANTS.REPORT_NOTE_MAX_LENGTH, {
    message: `Ghi chú báo cáo không được vượt quá ${FORUM_CONSTANTS.REPORT_NOTE_MAX_LENGTH} ký tự`,
  })
  note?: string;
}

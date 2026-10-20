import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FORUM_CONSTANTS } from '../constants';
import { trimString } from './forum-post.dto';

export class UpdateForumCommentDto {
  @ApiProperty({ example: 'Phòng còn chỗ không bạn ơi?' })
  @Transform(trimString)
  @IsString({ message: 'Nội dung bình luận phải là chuỗi' })
  @MinLength(1, { message: 'Nội dung bình luận không được để trống' })
  @MaxLength(FORUM_CONSTANTS.COMMENT_MAX_LENGTH, {
    message: `Bình luận không được vượt quá ${FORUM_CONSTANTS.COMMENT_MAX_LENGTH} ký tự`,
  })
  content!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Xác nhận vẫn gửi dù nội dung có cảnh báo',
  })
  @IsOptional()
  @IsBoolean({ message: 'Cờ xác nhận cảnh báo phải là kiểu boolean' })
  acknowledgeWarnings?: boolean;
}

export class CreateForumCommentDto extends UpdateForumCommentDto {
  @ApiPropertyOptional({ description: 'ID bình luận được trả lời' })
  @IsOptional()
  @IsUUID('4', { message: 'ID bình luận cha không hợp lệ' })
  parentId?: string;
}

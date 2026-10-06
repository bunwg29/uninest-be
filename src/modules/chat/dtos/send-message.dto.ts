import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { CHAT_LIMITS } from '../constants';

export class SendMessageDto {
  @ApiProperty({
    description:
      'Mã tin nhắn do ứng dụng sinh ra để chống gửi trùng khi gửi lại lúc mất mạng',
  })
  @IsUUID('4', { message: 'Mã tin nhắn phía ứng dụng không hợp lệ' })
  clientMessageId!: string;

  @ApiPropertyOptional({
    description: 'Nội dung văn bản hoặc chú thích đi kèm ảnh',
    maxLength: CHAT_LIMITS.MAX_CONTENT_LENGTH,
  })
  @IsOptional()
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự' })
  @MaxLength(CHAT_LIMITS.MAX_CONTENT_LENGTH, {
    message: `Nội dung tin nhắn tối đa ${CHAT_LIMITS.MAX_CONTENT_LENGTH} ký tự`,
  })
  content?: string;

  @ApiPropertyOptional({
    description: 'Danh sách object key ảnh đã tải lên R2 (thư mục chat/)',
    type: [String],
    maxItems: CHAT_LIMITS.MAX_IMAGES_PER_MESSAGE,
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách ảnh không hợp lệ' })
  @ArrayMaxSize(CHAT_LIMITS.MAX_IMAGES_PER_MESSAGE, {
    message: `Mỗi tin nhắn tối đa ${CHAT_LIMITS.MAX_IMAGES_PER_MESSAGE} ảnh`,
  })
  @IsString({ each: true, message: 'Đường dẫn ảnh không hợp lệ' })
  @Matches(/^chat\/[A-Za-z0-9_\-/]+\.[a-z0-9]+$/, {
    each: true,
    message: 'Ảnh đính kèm phải được tải lên thư mục chat',
  })
  imageKeys?: string[];
}

export class SendSocketMessageDto extends SendMessageDto {
  @ApiProperty({ description: 'Mã cuộc hội thoại nhận tin nhắn' })
  @IsUUID('4', { message: 'Mã cuộc hội thoại không hợp lệ' })
  conversationId!: string;
}

export class MarkConversationReadDto {
  @ApiProperty({ description: 'Mã cuộc hội thoại cần đánh dấu đã đọc' })
  @IsUUID('4', { message: 'Mã cuộc hội thoại không hợp lệ' })
  conversationId!: string;
}

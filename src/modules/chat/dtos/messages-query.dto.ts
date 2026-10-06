import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { CHAT_LIMITS } from '../constants';

export class MessagesQueryDto {
  @ApiPropertyOptional({
    description:
      'Mã tin nhắn cũ nhất đang hiển thị, dùng để tải các tin nhắn trước đó',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Con trỏ phân trang không hợp lệ' })
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Số tin nhắn mỗi trang',
    default: CHAT_LIMITS.DEFAULT_MESSAGE_PAGE_SIZE,
    maximum: CHAT_LIMITS.MAX_MESSAGE_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng tin nhắn phải là số nguyên' })
  @Min(1, { message: 'Số lượng tin nhắn tối thiểu là 1' })
  @Max(CHAT_LIMITS.MAX_MESSAGE_PAGE_SIZE, {
    message: `Số lượng tin nhắn tối đa là ${CHAT_LIMITS.MAX_MESSAGE_PAGE_SIZE}`,
  })
  limit: number = CHAT_LIMITS.DEFAULT_MESSAGE_PAGE_SIZE;
}

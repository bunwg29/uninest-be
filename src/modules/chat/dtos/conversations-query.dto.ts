import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@common/dtos';
import { CHAT_LIMITS } from '../constants';

export const CONVERSATION_FILTERS = ['all', 'unread'] as const;

export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number];

export class ConversationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Bộ lọc danh sách hội thoại',
    enum: CONVERSATION_FILTERS,
    default: 'all',
  })
  @IsOptional()
  @IsIn(CONVERSATION_FILTERS, { message: 'Bộ lọc hội thoại không hợp lệ' })
  filter: ConversationFilter = 'all';

  @ApiPropertyOptional({
    description: 'Từ khoá tìm theo tên người đối thoại hoặc tiêu đề tin đăng',
    maxLength: CHAT_LIMITS.MAX_SEARCH_KEYWORD_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Từ khoá tìm kiếm phải là chuỗi ký tự' })
  @MaxLength(CHAT_LIMITS.MAX_SEARCH_KEYWORD_LENGTH, {
    message: `Từ khoá tối đa ${CHAT_LIMITS.MAX_SEARCH_KEYWORD_LENGTH} ký tự`,
  })
  keyword?: string;
}

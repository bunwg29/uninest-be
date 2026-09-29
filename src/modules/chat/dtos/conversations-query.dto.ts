import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@common/dtos';

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
}

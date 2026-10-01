import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '../entities/message-type';

export class ChatMessageResponseDto {
  @ApiProperty() id!: string;

  @ApiProperty() conversationId!: string;

  @ApiProperty() senderId!: string;

  @ApiProperty() clientMessageId!: string;

  @ApiProperty({ enum: MessageType }) type!: MessageType;

  @ApiProperty({ nullable: true, type: String }) content!: string | null;

  @ApiProperty({ type: [String] }) imageUrls!: string[];

  @ApiProperty({ description: 'Tin nhắn đã được người gửi thu hồi' })
  isRecalled!: boolean;

  @ApiProperty({ nullable: true, type: Date }) readAt!: Date | null;

  @ApiProperty({ nullable: true, type: Date }) editedAt!: Date | null;

  @ApiProperty() createdAt!: Date;
}

export class ChatCounterpartDto {
  @ApiProperty() id!: string;

  @ApiProperty() fullName!: string;

  @ApiProperty({ nullable: true, type: String }) avatarUrl!: string | null;

  @ApiProperty() isOnline!: boolean;

  @ApiProperty({ nullable: true, type: Date }) lastSeenAt!: Date | null;
}

export class ChatListingSummaryDto {
  @ApiProperty() id!: string;

  @ApiProperty() title!: string;

  @ApiProperty({ description: 'Giá thuê mỗi tháng (VNĐ)' }) price!: number;

  @ApiProperty() status!: string;

  @ApiProperty({ nullable: true, type: String }) coverImageUrl!: string | null;
}

export class ChatLastMessageDto {
  @ApiProperty() senderId!: string;

  @ApiProperty({ enum: MessageType }) type!: MessageType;

  @ApiProperty({ nullable: true, type: String }) content!: string | null;

  @ApiProperty() imageCount!: number;

  @ApiProperty() isRecalled!: boolean;

  @ApiProperty({ nullable: true, type: Date }) readAt!: Date | null;

  @ApiProperty() createdAt!: Date;
}

export class ConversationResponseDto {
  @ApiProperty() id!: string;

  @ApiProperty({ type: ChatListingSummaryDto })
  listing!: ChatListingSummaryDto;

  @ApiProperty({ type: ChatCounterpartDto })
  counterpart!: ChatCounterpartDto;

  @ApiPropertyOptional({ type: ChatLastMessageDto, nullable: true })
  lastMessage!: ChatLastMessageDto | null;

  @ApiProperty() unreadCount!: number;

  @ApiProperty({ nullable: true, type: Date }) lastMessageAt!: Date | null;

  @ApiProperty() createdAt!: Date;
}

export class ConversationSummaryResponseDto {
  @ApiProperty() totalConversations!: number;

  @ApiProperty() unreadConversations!: number;

  @ApiProperty() unreadMessages!: number;
}

export class MessagesPageResponseDto {
  @ApiProperty({
    type: [ChatMessageResponseDto],
    description: 'Sắp xếp từ mới nhất đến cũ nhất',
  })
  items!: ChatMessageResponseDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;

  @ApiProperty() hasMore!: boolean;
}

export class MarkReadResponseDto {
  @ApiProperty() conversationId!: string;

  @ApiProperty() readerId!: string;

  @ApiProperty({ nullable: true, type: Date }) readAt!: Date | null;

  @ApiProperty() updatedCount!: number;
}

export class ConversationDeletedResponseDto {
  @ApiProperty() conversationId!: string;
}

import { Injectable } from '@nestjs/common';
import { R2StorageService } from '@core/storage';
import { Listing, ListingImage } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import {
  ChatCounterpartDto,
  ChatLastMessageDto,
  ChatListingSummaryDto,
  ChatMessageResponseDto,
} from '../dtos';
import { Message } from '../entities';
import { ChatPresenceService } from './chat-presence.service';
import type { LastMessageSnapshot } from './chat.service';

@Injectable()
export class ChatMapperService {
  constructor(
    private readonly storageService: R2StorageService,
    private readonly presenceService: ChatPresenceService,
  ) {}

  toMessage(message: Message): ChatMessageResponseDto {
    const isRecalled = message.recalledAt !== null;

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientMessageId: message.clientMessageId,
      type: message.type,
      content: isRecalled ? null : message.content,
      imageUrls: isRecalled
        ? []
        : message.imageKeys.map((key) => this.storageService.getPublicUrl(key)),
      isRecalled,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }

  toLastMessage(message: LastMessageSnapshot): ChatLastMessageDto {
    const isRecalled = message.recalledAt !== null;

    return {
      senderId: message.senderId,
      type: message.type,
      content: isRecalled ? null : message.content,
      imageCount: isRecalled ? 0 : message.imageCount,
      isRecalled,
      readAt: message.readAt,
      createdAt: message.createdAt,
    };
  }

  toCounterpart(user: User): ChatCounterpartDto {
    return {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl
        ? this.storageService.getPublicUrl(user.avatarUrl)
        : null,
      isOnline: this.presenceService.isOnline(user.id),
      lastSeenAt: this.presenceService.getLastSeenAt(user.id),
    };
  }

  toListingSummary(
    listing: Listing,
    coverImage?: ListingImage,
  ): ChatListingSummaryDto {
    return {
      id: listing.id,
      title: listing.title,
      price: Number(listing.price),
      status: listing.status,
      coverImageUrl: coverImage
        ? this.storageService.getPublicUrl(coverImage.url)
        : null,
    };
  }
}

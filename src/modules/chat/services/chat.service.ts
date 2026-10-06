import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { R2StorageService } from '@core/storage';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '@modules/booking/entities';
import { createPaginatedResult } from '@common/dtos';
import {
  Listing,
  ListingImage,
  ListingStatus,
} from '@modules/listings/entities';
import {
  ChatMessageResponseDto,
  ConversationDeletedResponseDto,
  ConversationResponseDto,
  ConversationSummaryResponseDto,
  ConversationsQueryDto,
  CreateConversationDto,
  MarkReadResponseDto,
  MessagesPageResponseDto,
  MessagesQueryDto,
  SendMessageDto,
} from '../dtos';
import { CHAT_EVENTS, CHAT_LIMITS } from '../constants';
import { Conversation, Message, MessageType } from '../entities';
import { ChatMapperService } from './chat-mapper.service';

const UNIQUE_VIOLATION_CODE = '23505';

export interface MessageCreatedEvent {
  message: ChatMessageResponseDto;
  participantIds: [string, string];
  recipientId: string;
  listingId: string;
}

export interface MessageRecalledEvent {
  message: ChatMessageResponseDto;
  participantIds: [string, string];
}

export interface ConversationDeletedEvent {
  conversationId: string;
  userId: string;
}

export interface ConversationReadEvent extends MarkReadResponseDto {
  participantIds: [string, string];
}

export interface LastMessageSnapshot {
  senderId: string;
  type: MessageType;
  content: string | null;
  imageCount: number;
  readAt: Date | null;
  recalledAt: Date | null;
  createdAt: Date;
}

interface ConversationStats {
  unreadCount: number;
  lastMessage: LastMessageSnapshot | null;
}

interface ConversationStatsRow {
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  imageCount: number;
  readAt: Date | null;
  recalledAt: Date | null;
  createdAt: Date | null;
  unreadCount: number;
}

export interface SendMessageResult {
  message: ChatMessageResponseDto;
  isDuplicate: boolean;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    @InjectRepository(ListingImage)
    private readonly listingImageRepository: Repository<ListingImage>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly mapper: ChatMapperService,
    private readonly eventEmitter: EventEmitter2,
    private readonly storageService: R2StorageService,
  ) {}

  async createOrGetConversationForLandlord(
    landlordId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    if (!dto.studentId) {
      throw new BadRequestException('Vui lòng chọn sinh viên cần nhắn tin');
    }

    const listing = await this.listingRepository.findOne({
      where: { id: dto.listingId },
    });

    if (!listing || listing.ownerId !== landlordId) {
      throw new ForbiddenException('Bạn không phải chủ của tin đăng này');
    }

    const hasBooking = await this.bookingRepository.exists({
      where: { listingId: listing.id, userId: dto.studentId },
    });

    if (!hasBooking) {
      throw new ForbiddenException(
        'Chỉ có thể nhắn tin với sinh viên đã đặt lịch xem phòng này',
      );
    }

    const existing = await this.conversationRepository.findOne({
      where: { listingId: listing.id, studentId: dto.studentId },
    });

    if (existing) {
      return this.getConversation(landlordId, existing.id);
    }

    try {
      const created = await this.conversationRepository.save(
        this.conversationRepository.create({
          listingId: listing.id,
          studentId: dto.studentId,
          landlordId,
        }),
      );

      return await this.getConversation(landlordId, created.id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const concurrent = await this.conversationRepository.findOneOrFail({
          where: { listingId: listing.id, studentId: dto.studentId },
        });

        return this.getConversation(landlordId, concurrent.id);
      }

      throw error;
    }
  }

  async createOrGetConversation(
    studentId: string,
    dto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    const listing = await this.listingRepository.findOne({
      where: { id: dto.listingId },
    });

    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException(
        'Tin đăng không tồn tại hoặc đã ngừng hiển thị',
      );
    }

    if (listing.ownerId === studentId) {
      throw new BadRequestException(
        'Bạn không thể nhắn tin cho chính tin đăng của mình',
      );
    }

    const existing = await this.conversationRepository.findOne({
      where: { listingId: listing.id, studentId },
    });

    if (existing) {
      return this.getConversation(studentId, existing.id);
    }

    try {
      const created = await this.conversationRepository.save(
        this.conversationRepository.create({
          listingId: listing.id,
          studentId,
          landlordId: listing.ownerId,
        }),
      );

      return await this.getConversation(studentId, created.id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const concurrent = await this.conversationRepository.findOneOrFail({
          where: { listingId: listing.id, studentId },
        });

        return this.getConversation(studentId, concurrent.id);
      }

      throw error;
    }
  }

  async listConversations(userId: string, query: ConversationsQueryDto) {
    const queryBuilder = this.createConversationQueryBuilder()
      .where(
        '(conversation.studentId = :userId OR conversation.landlordId = :userId)',
        { userId },
      )
      .andWhere('conversation.lastMessageAt IS NOT NULL')
      .andWhere(
        `conversation.last_message_at > ${this.buildHiddenAtExpression('conversation', ':userId')}`,
      );

    if (query.keyword) {
      queryBuilder.andWhere(
        `(CASE WHEN conversation.student_id = :userId THEN landlord.full_name ELSE student.full_name END ILIKE :pattern
          OR listing.title ILIKE :pattern)`,
        { pattern: `%${this.escapeLikePattern(query.keyword)}%` },
      );
    }

    if (query.filter === 'unread') {
      queryBuilder.andWhere(this.buildUnreadExistsClause('conversation'), {
        userId,
      });
    }

    const conversations = await queryBuilder
      .orderBy('conversation.lastMessageAt', 'DESC')
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getMany();

    const isSinglePage = query.page === 1 && conversations.length < query.limit;
    const total = isSinglePage
      ? conversations.length
      : await queryBuilder.clone().getCount();

    const items = await this.buildConversationResponses(userId, conversations);

    return createPaginatedResult(items, total, query.page, query.limit);
  }

  async getSummary(userId: string): Promise<ConversationSummaryResponseDto> {
    const totalConversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .where(
        '(conversation.studentId = :userId OR conversation.landlordId = :userId)',
        { userId },
      )
      .andWhere('conversation.lastMessageAt IS NOT NULL')
      .andWhere(
        `conversation.last_message_at > ${this.buildHiddenAtExpression('conversation', ':userId')}`,
      )
      .getCount();

    const unreadRows = await this.messageRepository
      .createQueryBuilder('message')
      .innerJoin('message.conversation', 'conversation')
      .select('message.conversationId', 'conversationId')
      .addSelect('COUNT(message.id)', 'unreadCount')
      .where(
        '(conversation.studentId = :userId OR conversation.landlordId = :userId)',
        { userId },
      )
      .andWhere('conversation.deletedAt IS NULL')
      .andWhere(
        `message.created_at > ${this.buildHiddenAtExpression('conversation', ':userId')}`,
      )
      .andWhere('message.senderId <> :userId', { userId })
      .andWhere('message.readAt IS NULL')
      .andWhere('message.recalledAt IS NULL')
      .groupBy('message.conversationId')
      .getRawMany<{ conversationId: string; unreadCount: string }>();

    return {
      totalConversations,
      unreadConversations: unreadRows.length,
      unreadMessages: unreadRows.reduce(
        (sum, row) => sum + Number(row.unreadCount),
        0,
      ),
    };
  }

  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationResponseDto> {
    const conversation = await this.findParticipantConversation(
      userId,
      conversationId,
      true,
    );

    const [response] = await this.buildConversationResponses(userId, [
      conversation,
    ]);

    return response;
  }

  async listMessages(
    userId: string,
    conversationId: string,
    query: MessagesQueryDto,
  ): Promise<MessagesPageResponseDto> {
    const conversation = await this.findParticipantConversation(
      userId,
      conversationId,
    );

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId });

    const hiddenAt = this.getHiddenAt(conversation, userId);

    if (hiddenAt) {
      queryBuilder.andWhere('message.created_at > :hiddenAt', { hiddenAt });
    }

    if (query.cursor) {
      const cursorMessage = await this.messageRepository.findOne({
        where: { id: query.cursor, conversationId },
        select: { id: true },
      });

      if (!cursorMessage) {
        throw new BadRequestException('Con trỏ phân trang không hợp lệ');
      }

      queryBuilder.andWhere(
        '(message.created_at, message.id) < (SELECT cursor.created_at, cursor.id FROM messages cursor WHERE cursor.id = :cursorId)',
        { cursorId: query.cursor },
      );
    }

    const rows = await queryBuilder
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(query.limit + 1)
      .getMany();

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: pageRows.map((message) => this.mapper.toMessage(message)),
      nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null,
      hasMore,
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<SendMessageResult> {
    const conversation = await this.findParticipantConversation(
      userId,
      conversationId,
    );

    const content = dto.content?.trim() || null;
    const imageKeys = this.normalizeImageKeys(dto.imageKeys);

    if (!content && imageKeys.length === 0) {
      throw new BadRequestException(
        'Tin nhắn phải có nội dung văn bản hoặc ít nhất một ảnh',
      );
    }

    const duplicate = await this.messageRepository.findOne({
      where: {
        conversationId,
        senderId: userId,
        clientMessageId: dto.clientMessageId,
      },
    });

    if (duplicate) {
      return { message: this.mapper.toMessage(duplicate), isDuplicate: true };
    }

    await Promise.all(
      imageKeys.map((key) => this.storageService.assertValidImageObject(key)),
    );

    let saved: Message;

    try {
      saved = await this.messageRepository.manager.transaction(
        async (manager) => {
          const created = await manager.save(
            manager.create(Message, {
              conversationId,
              senderId: userId,
              clientMessageId: dto.clientMessageId,
              type: imageKeys.length > 0 ? MessageType.IMAGE : MessageType.TEXT,
              content,
              imageKeys,
            }),
          );

          await manager.update(Conversation, conversationId, {
            lastMessageAt: created.createdAt,
          });

          return created;
        },
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const concurrent = await this.messageRepository.findOneOrFail({
          where: {
            conversationId,
            senderId: userId,
            clientMessageId: dto.clientMessageId,
          },
        });

        return {
          message: this.mapper.toMessage(concurrent),
          isDuplicate: true,
        };
      }

      throw error;
    }

    const message = this.mapper.toMessage(saved);

    const event: MessageCreatedEvent = {
      message,
      participantIds: this.getParticipantIds(conversation),
      recipientId: this.getCounterpartId(conversation, userId),
      listingId: conversation.listingId,
    };

    this.eventEmitter.emit(CHAT_EVENTS.MESSAGE_CREATED, event);

    return { message, isDuplicate: false };
  }

  async markConversationRead(
    userId: string,
    conversationId: string,
  ): Promise<MarkReadResponseDto> {
    const conversation = await this.findParticipantConversation(
      userId,
      conversationId,
    );

    const readAt = new Date();

    const result = await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ readAt })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id <> :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();

    const updatedCount = result.affected ?? 0;

    const response: MarkReadResponseDto = {
      conversationId,
      readerId: userId,
      readAt: updatedCount > 0 ? readAt : null,
      updatedCount,
    };

    if (updatedCount > 0) {
      const event: ConversationReadEvent = {
        ...response,
        participantIds: this.getParticipantIds(conversation),
      };

      this.eventEmitter.emit(CHAT_EVENTS.CONVERSATION_READ, event);
    }

    return response;
  }

  async recallMessage(
    userId: string,
    conversationId: string,
    messageId: string,
  ): Promise<ChatMessageResponseDto> {
    const conversation = await this.findParticipantConversation(
      userId,
      conversationId,
    );

    const message = await this.messageRepository.findOne({
      where: { id: messageId, conversationId },
    });

    if (!message) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Bạn chỉ có thể thu hồi tin nhắn của mình');
    }

    if (message.recalledAt) {
      return this.mapper.toMessage(message);
    }

    message.recalledAt = new Date();

    const saved = await this.messageRepository.save(message);
    const response = this.mapper.toMessage(saved);

    const event: MessageRecalledEvent = {
      message: response,
      participantIds: this.getParticipantIds(conversation),
    };

    this.eventEmitter.emit(CHAT_EVENTS.MESSAGE_RECALLED, event);

    return response;
  }

  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationDeletedResponseDto> {
    const conversation = await this.findParticipantConversation(
      userId,
      conversationId,
    );

    const column =
      conversation.studentId === userId
        ? 'studentDeletedAt'
        : 'landlordDeletedAt';

    await this.conversationRepository.update(conversationId, {
      [column]: new Date(),
    });

    const event: ConversationDeletedEvent = { conversationId, userId };

    this.eventEmitter.emit(CHAT_EVENTS.CONVERSATION_DELETED, event);

    return { conversationId };
  }

  private async findParticipantConversation(
    userId: string,
    conversationId: string,
    withRelations = false,
  ): Promise<Conversation> {
    const conversation = withRelations
      ? await this.createConversationQueryBuilder()
          .where('conversation.id = :conversationId', { conversationId })
          .getOne()
      : await this.conversationRepository.findOne({
          where: { id: conversationId },
        });

    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    if (
      conversation.studentId !== userId &&
      conversation.landlordId !== userId
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập cuộc trò chuyện này',
      );
    }

    return conversation;
  }

  private createConversationQueryBuilder() {
    return this.conversationRepository
      .createQueryBuilder('conversation')
      .innerJoin('conversation.listing', 'listing')
      .innerJoin('conversation.student', 'student')
      .innerJoin('conversation.landlord', 'landlord')
      .addSelect([
        'listing.id',
        'listing.title',
        'listing.price',
        'listing.status',
        'student.id',
        'student.fullName',
        'student.avatarUrl',
        'landlord.id',
        'landlord.fullName',
        'landlord.avatarUrl',
      ]);
  }

  private async buildConversationResponses(
    userId: string,
    conversations: Conversation[],
  ): Promise<ConversationResponseDto[]> {
    if (conversations.length === 0) {
      return [];
    }

    const conversationIds = conversations.map(({ id }) => id);
    const listingIds = [...new Set(conversations.map((c) => c.listingId))];

    const [coverImages, stats] = await Promise.all([
      this.loadCoverImages(listingIds),
      this.loadConversationStats(userId, conversationIds),
    ]);

    return conversations.map((conversation) => {
      const counterpart =
        conversation.studentId === userId
          ? conversation.landlord
          : conversation.student;

      const conversationStats = stats.get(conversation.id);

      return {
        id: conversation.id,
        listing: this.mapper.toListingSummary(
          conversation.listing,
          coverImages.get(conversation.listingId),
        ),
        counterpart: this.mapper.toCounterpart(counterpart),
        lastMessage: conversationStats?.lastMessage
          ? this.mapper.toLastMessage(conversationStats.lastMessage)
          : null,
        unreadCount: conversationStats?.unreadCount ?? 0,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
      };
    });
  }

  private async loadCoverImages(
    listingIds: string[],
  ): Promise<Map<string, ListingImage>> {
    const images = await this.listingImageRepository
      .createQueryBuilder('image')
      .distinctOn(['image.listingId'])
      .where('image.listingId IN (:...listingIds)', { listingIds })
      .orderBy('image.listingId')
      .addOrderBy('image.isCover', 'DESC')
      .addOrderBy('image.sortOrder', 'ASC')
      .getMany();

    return new Map(images.map((image) => [image.listingId, image]));
  }

  private async loadConversationStats(
    userId: string,
    conversationIds: string[],
  ): Promise<Map<string, ConversationStats>> {
    const rows = await this.messageRepository.query<ConversationStatsRow[]>(
      `SELECT
         c.id AS "conversationId",
         last_message.sender_id AS "senderId",
         last_message.type AS "type",
         last_message.content AS "content",
         COALESCE(cardinality(last_message.image_keys), 0)::int AS "imageCount",
         last_message.read_at AS "readAt",
         last_message.recalled_at AS "recalledAt",
         last_message.created_at AS "createdAt",
         (
           SELECT COUNT(*)::int FROM messages unread_message
           WHERE unread_message.conversation_id = c.id
             AND unread_message.sender_id <> $1
             AND unread_message.read_at IS NULL
             AND unread_message.recalled_at IS NULL
             AND unread_message.deleted_at IS NULL
             AND unread_message.created_at > ${this.buildHiddenAtExpression('c', '$1')}
         ) AS "unreadCount"
       FROM conversations c
       LEFT JOIN LATERAL (
         SELECT m.sender_id, m.type, m.content, m.image_keys, m.read_at,
                m.recalled_at, m.created_at
         FROM messages m
         WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
           AND m.created_at > ${this.buildHiddenAtExpression('c', '$1')}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 1
       ) last_message ON TRUE
       WHERE c.id = ANY($2::uuid[])`,
      [userId, conversationIds],
    );

    return new Map(
      rows.map((row) => [
        row.conversationId,
        {
          unreadCount: row.unreadCount,
          lastMessage: row.createdAt
            ? {
                senderId: row.senderId,
                type: row.type,
                content: row.content,
                imageCount: row.imageCount,
                readAt: row.readAt,
                recalledAt: row.recalledAt,
                createdAt: row.createdAt,
              }
            : null,
        },
      ]),
    );
  }

  private buildHiddenAtExpression(
    conversationAlias: string,
    userParameter: string,
  ): string {
    return `COALESCE(
      CASE WHEN ${conversationAlias}.student_id = ${userParameter}
        THEN ${conversationAlias}.student_deleted_at
        ELSE ${conversationAlias}.landlord_deleted_at END,
      'epoch'::timestamptz)`;
  }

  private getHiddenAt(conversation: Conversation, userId: string): Date | null {
    return conversation.studentId === userId
      ? conversation.studentDeletedAt
      : conversation.landlordDeletedAt;
  }

  private escapeLikePattern(keyword: string): string {
    return keyword.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  private buildUnreadExistsClause(conversationAlias: string): string {
    return `EXISTS (
      SELECT 1 FROM messages unread_message
      WHERE unread_message.conversation_id = ${conversationAlias}.id
        AND unread_message.sender_id <> :userId
        AND unread_message.read_at IS NULL
        AND unread_message.recalled_at IS NULL
        AND unread_message.deleted_at IS NULL
        AND unread_message.created_at > ${this.buildHiddenAtExpression(conversationAlias, ':userId')}
    )`;
  }

  private normalizeImageKeys(imageKeys: string[] | undefined): string[] {
    const keys = [...new Set(imageKeys ?? [])];

    const hasInvalidKey = keys.some(
      (key) =>
        !key.startsWith(CHAT_LIMITS.IMAGE_KEY_PREFIX) || key.includes('..'),
    );

    if (hasInvalidKey) {
      throw new BadRequestException('Ảnh đính kèm không hợp lệ');
    }

    return keys;
  }

  private getParticipantIds(conversation: Conversation): [string, string] {
    return [conversation.studentId, conversation.landlordId];
  }

  private getCounterpartId(conversation: Conversation, userId: string): string {
    return conversation.studentId === userId
      ? conversation.landlordId
      : conversation.studentId;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === UNIQUE_VIOLATION_CODE
    );
  }
}

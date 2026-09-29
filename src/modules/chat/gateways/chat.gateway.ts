import { HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Server, Socket } from 'socket.io';
import { UsersService } from '@modules/users/users.service';
import {
  CHAT_EVENTS,
  CHAT_SOCKET_EVENTS,
  CHAT_SOCKET_NAMESPACE,
} from '../constants';
import { MarkConversationReadDto, SendSocketMessageDto } from '../dtos';
import { ChatPresenceService } from '../services/chat-presence.service';
import { ChatService } from '../services/chat.service';
import type {
  ConversationReadEvent,
  MessageCreatedEvent,
  MessageRecalledEvent,
} from '../services/chat.service';

interface SocketAck<T> {
  status: boolean;
  data: T | null;
  error: string | null;
  messages: string | string[];
}

interface ChatSocketData {
  userId?: string;
  expiresAt?: number;
  expiryTimer?: NodeJS.Timeout;
}

interface AuthenticatedIdentity {
  userId: string;
  expiresAt: number;
}

const SOCKET_AUTH_ERROR_MESSAGE =
  'Phiên đăng nhập không hợp lệ hoặc đã hết hạn';

@WebSocketGateway({
  namespace: CHAT_SOCKET_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly chatService: ChatService,
    private readonly presenceService: ChatPresenceService,
  ) {}

  afterInit(server: Server): void {
    server.use((client, next) => {
      void this.authenticate(client).then((identity) => {
        if (!identity) {
          next(new Error(SOCKET_AUTH_ERROR_MESSAGE));

          return;
        }

        const data = client.data as ChatSocketData;

        data.userId = identity.userId;
        data.expiresAt = identity.expiresAt;

        next();
      });
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const { userId } = client.data as ChatSocketData;

    if (!userId) {
      return;
    }

    const data = client.data as ChatSocketData;

    data.expiryTimer = setTimeout(
      () => client.disconnect(true),
      Math.max(0, (data.expiresAt ?? 0) - Date.now()),
    );

    await client.join(this.getUserRoom(userId));

    this.presenceService.markConnected(userId);
  }

  handleDisconnect(client: Socket): void {
    const { userId, expiryTimer } = client.data as ChatSocketData;

    clearTimeout(expiryTimer);

    if (userId) {
      this.presenceService.markDisconnected(userId);
    }
  }

  @SubscribeMessage(CHAT_SOCKET_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    return this.runAck(client, async (userId) => {
      const dto = await this.parsePayload(SendSocketMessageDto, payload);
      const { conversationId, ...messageDto } = dto;

      const { message } = await this.chatService.sendMessage(
        userId,
        conversationId,
        messageDto,
      );

      return message;
    });
  }

  @SubscribeMessage(CHAT_SOCKET_EVENTS.MARK_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ) {
    return this.runAck(client, async (userId) => {
      const dto = await this.parsePayload(MarkConversationReadDto, payload);

      return this.chatService.markConversationRead(userId, dto.conversationId);
    });
  }

  @OnEvent(CHAT_EVENTS.MESSAGE_CREATED)
  broadcastMessageCreated(event: MessageCreatedEvent): void {
    this.emitToParticipants(
      event.participantIds,
      CHAT_SOCKET_EVENTS.NEW_MESSAGE,
      event.message,
    );
  }

  @OnEvent(CHAT_EVENTS.MESSAGE_RECALLED)
  broadcastMessageRecalled(event: MessageRecalledEvent): void {
    this.emitToParticipants(
      event.participantIds,
      CHAT_SOCKET_EVENTS.MESSAGE_RECALLED,
      event.message,
    );
  }

  @OnEvent(CHAT_EVENTS.CONVERSATION_READ)
  broadcastConversationRead(event: ConversationReadEvent): void {
    const { participantIds, ...payload } = event;

    this.emitToParticipants(
      participantIds,
      CHAT_SOCKET_EVENTS.MESSAGES_READ,
      payload,
    );
  }

  private emitToParticipants(
    participantIds: string[],
    eventName: string,
    payload: unknown,
  ): void {
    const rooms = participantIds.map((id) => this.getUserRoom(id));

    this.server.to(rooms).emit(eventName, payload);
  }

  private async authenticate(
    client: Socket,
  ): Promise<AuthenticatedIdentity | null> {
    const token = this.extractToken(client);

    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        exp: number;
      }>(token, {
        secret: this.configService.get<string>(
          'JWT_ACCESS_SECRET',
          'uninest_dev_access_secret_key_32bytes!',
        ),
      });

      const user = await this.usersService.findById(payload.sub);

      return user?.isActive
        ? { userId: user.id, expiresAt: payload.exp * 1000 }
        : null;
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as { token?: unknown }).token;

    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const header = client.handshake.headers.authorization;

    if (typeof header === 'string' && /^Bearer\s+/i.test(header)) {
      return header.replace(/^Bearer\s+/i, '');
    }

    return null;
  }

  private async parsePayload<T extends object>(
    dtoClass: new () => T,
    payload: unknown,
  ): Promise<T> {
    const instance = plainToInstance(dtoClass, payload ?? {});

    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const messages = errors.flatMap((error) =>
        Object.values(error.constraints ?? {}),
      );

      throw new HttpException(messages, 400);
    }

    return instance;
  }

  private async runAck<T>(
    client: Socket,
    handler: (userId: string) => Promise<T>,
  ): Promise<SocketAck<T>> {
    const { userId } = client.data as ChatSocketData;

    if (!userId) {
      return {
        status: false,
        data: null,
        error: 'Unauthorized',
        messages: SOCKET_AUTH_ERROR_MESSAGE,
      };
    }

    try {
      const data = await handler(userId);

      return {
        status: true,
        data,
        error: null,
        messages: 'Thao tác thành công',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse();
        const message =
          typeof response === 'object' && 'message' in response
            ? (response as { message: string | string[] }).message
            : error.message;

        return {
          status: false,
          data: null,
          error: error.name,
          messages: message,
        };
      }

      this.logger.error(error instanceof Error ? error.stack : String(error));

      return {
        status: false,
        data: null,
        error: 'InternalServerError',
        messages: 'Lỗi máy chủ nội bộ',
      };
    }
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '@modules/booking/entities';
import { Listing, ListingImage } from '@modules/listings/entities';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ChatController } from './controllers/chat.controller';
import { Conversation, Message } from './entities';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatMapperService } from './services/chat-mapper.service';
import { ChatPresenceService } from './services/chat-presence.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      Message,
      Listing,
      ListingImage,
      Booking,
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatMapperService, ChatPresenceService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}

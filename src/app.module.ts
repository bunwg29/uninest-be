import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppConfigModule, DatabaseModule, StorageModule } from '@core';
import {
  HealthModule,
  AuthModule,
  UsersModule,
  ListingsModule,
  SearchModule,
  BookingModule,
  ChatModule,
  ForumModule,
  ReviewsModule,
  NotificationsModule,
  PaymentModule,
  RecommendationsModule,
  AiChatModule,
  LocationsModule,
} from '@modules';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    AppConfigModule,
    DatabaseModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SearchModule,
    ListingsModule,
    BookingModule,
    ChatModule,
    ForumModule,
    ReviewsModule,
    NotificationsModule,
    PaymentModule,
    RecommendationsModule,
    AiChatModule,
    LocationsModule,
  ],
})
export class AppModule {}

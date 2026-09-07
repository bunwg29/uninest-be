import { Module } from '@nestjs/common';
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
  ComparisonModule,
  RecommendationsModule,
  AiChatModule,
} from '@modules';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    StorageModule,
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
    ComparisonModule,
    RecommendationsModule,
    AiChatModule,
  ],
})
export class AppModule {}

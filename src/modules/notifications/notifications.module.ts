import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '@modules/booking/entities';
import { Listing } from '@modules/listings/entities';
import {
  Notification,
  NotificationDelivery,
  NotificationPreference,
  PushDevice,
  SavedSearch,
} from './entities';
import { NotificationsController } from './notifications.controller';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationsService } from './services/notifications.service';
import { SavedSearchesService } from './services/saved-searches.service';
import { SavedSearchesController } from './saved-searches.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationDelivery,
      NotificationPreference,
      PushDevice,
      SavedSearch,
      Booking,
      Listing,
    ]),
  ],
  controllers: [NotificationsController, SavedSearchesController],
  providers: [
    NotificationsService,
    NotificationQueueService,
    SavedSearchesService,
  ],
  exports: [NotificationQueueService],
})
export class NotificationsModule {}

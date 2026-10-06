import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '@modules/listings/entities';
import { BookingController } from './booking.controller';
import { Booking, BookingEvent } from './entities';
import { BookingExpirationService, BookingService } from './services';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Booking, BookingEvent, Listing]),
  ],
  controllers: [BookingController],
  providers: [BookingService, BookingExpirationService],
  exports: [BookingService, BookingExpirationService],
})
export class BookingModule {}

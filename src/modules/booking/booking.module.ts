import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '@modules/listings/entities';
import { BookingController } from './booking.controller';
import { Booking, BookingEvent } from './entities';
import { BookingExpirationService, BookingService } from './services';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingEvent, Listing])],
  controllers: [BookingController],
  providers: [BookingService, BookingExpirationService],
  exports: [BookingService, BookingExpirationService],
})
export class BookingModule {}

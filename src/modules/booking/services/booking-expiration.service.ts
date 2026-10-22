import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  BOOKING_ACTORS,
  BOOKING_EVENTS,
  type BookingStatusChangedPayload,
} from '../constants';
import { Booking, BookingEvent, BookingStatus } from '../entities';

@Injectable()
export class BookingExpirationService {
  private readonly logger = new Logger(BookingExpirationService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(BookingEvent)
    private readonly eventRepository: Repository<BookingEvent>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('*/5 * * * *')
  async handleExpiredBookings(): Promise<number> {
    const now = new Date();
    const expiredBookings = await this.bookingRepository.find({
      select: {
        id: true,
        listingId: true,
        userId: true,
        status: true,
        listing: { ownerId: true },
      },
      relations: { listing: true },
      where: [
        { status: BookingStatus.PENDING, expiresAt: LessThan(now) },
        { status: BookingStatus.PENDING, startTime: LessThan(now) },
      ],
    });

    if (expiredBookings.length === 0) {
      return 0;
    }

    const ids = expiredBookings.map((booking) => booking.id);
    const result = await this.bookingRepository
      .createQueryBuilder()
      .update(Booking)
      .set({ status: BookingStatus.EXPIRED, expiredAt: now, expiresAt: null })
      .whereInIds(ids)
      .andWhere('status = :status', { status: BookingStatus.PENDING })
      .returning('id')
      .execute();
    const affected = result.affected ?? 0;
    const affectedIds = new Set(
      (result.raw as Array<{ id: string }>).map((booking) => booking.id),
    );

    if (affectedIds.size > 0) {
      await this.eventRepository.insert(
        [...affectedIds].map((bookingId) => ({
          bookingId,
          eventType: BookingStatus.EXPIRED,
          actor: BOOKING_ACTORS.SYSTEM,
          metadata: null,
        })),
      );

      expiredBookings
        .filter((booking) => affectedIds.has(booking.id))
        .forEach((booking) => {
          this.eventEmitter.emit(BOOKING_EVENTS.STATUS_CHANGED, {
            bookingId: booking.id,
            listingId: booking.listingId,
            studentId: booking.userId,
            landlordId: booking.listing.ownerId,
            from: booking.status,
            to: BookingStatus.EXPIRED,
            actor: BOOKING_ACTORS.SYSTEM,
            reason: null,
          } satisfies BookingStatusChangedPayload);
        });
    }

    this.logger.log(
      `[CRON] Expired ${affected} bookings at ${now.toISOString()}`,
    );

    return affected;
  }
}

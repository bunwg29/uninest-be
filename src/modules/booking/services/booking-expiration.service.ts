import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Booking, BookingEvent, BookingStatus } from '../entities';

@Injectable()
export class BookingExpirationService {
  private readonly logger = new Logger(BookingExpirationService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(BookingEvent)
    private readonly eventRepository: Repository<BookingEvent>,
  ) {}

  @Cron('*/1 * * * *')
  async handleExpiredBookings(): Promise<number> {
    const now = new Date();
    const expiredBookings = await this.bookingRepository.find({
      select: { id: true },
      where: {
        status: In([BookingStatus.PENDING, BookingStatus.HOLDING]),
        expiresAt: LessThan(now),
      },
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
      .andWhere('status IN (:...statuses)', {
        statuses: [BookingStatus.PENDING, BookingStatus.HOLDING],
      })
      .andWhere('expires_at < :now', { now })
      .returning('id')
      .execute();
    const affected = result.affected ?? 0;
    const affectedIds = (result.raw as Array<{ id: string }>).map(
      (booking) => booking.id,
    );

    if (affectedIds.length > 0) {
      await this.eventRepository.insert(
        affectedIds.map((bookingId) => ({
          bookingId,
          eventType: 'expired',
          actor: 'system',
          metadata: null,
        })),
      );
    }

    this.logger.log(
      `[CRON] Đã hết hạn ${affected} lịch hẹn lúc ${now.toISOString()}`,
    );

    return affected;
  }
}

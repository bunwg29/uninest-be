import { DataSource, In } from 'typeorm';
import { Booking, BookingStatus } from './entities';

export type ListingAvailability = 'available' | 'holding' | 'rented' | 'paused';

export interface ListingHoldInfo {
  expiresAt: Date;
  daysLeft: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const findActiveHolds = async (
  dataSource: DataSource,
  listingIds: string[],
): Promise<Map<string, ListingHoldInfo>> => {
  const holds = new Map<string, ListingHoldInfo>();

  if (listingIds.length === 0) return holds;

  const bookings = await dataSource.getRepository(Booking).find({
    select: { listingId: true, expiresAt: true },
    where: { listingId: In(listingIds), status: BookingStatus.HOLDING },
  });
  const now = Date.now();

  bookings.forEach((booking) => {
    if (!booking.expiresAt) return;

    holds.set(booking.listingId, {
      expiresAt: booking.expiresAt,
      daysLeft: Math.max(
        0,
        Math.ceil((booking.expiresAt.getTime() - now) / MS_PER_DAY),
      ),
    });
  });

  return holds;
};

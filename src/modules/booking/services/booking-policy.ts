import { BookingStatus } from '../entities';

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [
    BookingStatus.CONFIRMED,
    BookingStatus.HOLDING,
    BookingStatus.EXPIRED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.HOLDING]: [
    BookingStatus.CONFIRMED,
    BookingStatus.EXPIRED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.CONFIRMED]: [BookingStatus.CANCELLED],
  [BookingStatus.EXPIRED]: [],
  [BookingStatus.CANCELLED]: [],
};

export const isBookingTransitionAllowed = (
  from: BookingStatus,
  to: BookingStatus,
) => TRANSITIONS[from].includes(to);

export const doTimeRangesOverlap = (
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
) => firstStart < secondEnd && firstEnd > secondStart;

export const isCancellationReasonRequired = (
  startTime: Date,
  now: Date,
  cancelFreeHours: number,
) => (startTime.getTime() - now.getTime()) / 3_600_000 < cancelFreeHours;

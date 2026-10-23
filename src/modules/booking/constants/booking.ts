import { MoreThan, type FindOptionsWhere } from 'typeorm';
import type { Booking } from '../entities/booking';
import { BookingStatus } from '../entities/booking-status';

export const BOOKING_EVENTS = {
  CREATED: 'booking.created',
  STATUS_CHANGED: 'booking.status_changed',
} as const;

export const BOOKING_ACTORS = {
  STUDENT: 'student',
  LANDLORD: 'landlord',
  SYSTEM: 'system',
} as const;

export type BookingActor = (typeof BOOKING_ACTORS)[keyof typeof BOOKING_ACTORS];

export const BOOKING_DEFAULTS = {
  RESPONSE_HOURS: 24,
  CANCEL_FREE_HOURS: 24,
  SLOT_DURATION_MINUTES: 60,
} as const;

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

export const activeBookingWhere = (
  where: FindOptionsWhere<Booking>,
  now = new Date(),
): FindOptionsWhere<Booking>[] => [
  { ...where, status: BookingStatus.PENDING },
  { ...where, status: BookingStatus.CONFIRMED, endTime: MoreThan(now) },
];

export interface BookingStatusChangedPayload {
  bookingId: string;
  listingId: string;
  studentId: string;
  landlordId: string;
  from: BookingStatus | null;
  to: BookingStatus;
  actor: BookingActor;
  reason?: string | null;
}

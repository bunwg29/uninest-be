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
  HOLDING_DAYS: 7,
  CANCEL_FREE_HOURS: 24,
  SLOT_DURATION_MINUTES: 60,
} as const;

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.HOLDING,
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

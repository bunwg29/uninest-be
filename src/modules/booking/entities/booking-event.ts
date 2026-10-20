import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BOOKING_ACTORS, type BookingActor } from '../constants/booking';
import { Booking } from './booking';
import { BookingStatus } from './booking-status';

export const BOOKING_EVENT_CREATED = 'created';

export const BOOKING_EVENT_TYPES = [
  BOOKING_EVENT_CREATED,
  ...Object.values(BookingStatus),
] as const;

export type BookingEventType = (typeof BOOKING_EVENT_TYPES)[number];

@Entity('booking_events')
export class BookingEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'booking_id' })
  bookingId!: string;

  @Column({ type: 'enum', enum: BOOKING_EVENT_TYPES, name: 'event_type' })
  eventType!: BookingEventType;

  @Column({ type: 'enum', enum: Object.values(BOOKING_ACTORS), nullable: true })
  actor!: BookingActor | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Booking, (booking) => booking.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;
}

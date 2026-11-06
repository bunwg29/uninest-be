import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Booking } from '@modules/booking/entities';
import { Listing } from '@modules/listings/entities';
import { User } from '@modules/users/entities';

@Entity('reviews')
@Index('uq_reviews_student_listing', ['studentId', 'listingId'], {
  unique: true,
})
@Index('uq_reviews_booking', ['bookingId'], { unique: true })
@Index('idx_reviews_listing_created', ['listingId', 'createdAt'], {
  where: 'deleted_at IS NULL',
})
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @Column({ type: 'uuid', name: 'booking_id' })
  bookingId!: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId!: string;

  @Column({ type: 'smallint', name: 'location_rating' })
  locationRating!: number;

  @Column({ type: 'smallint', name: 'value_rating' })
  valueRating!: number;

  @Column({ type: 'smallint', name: 'landlord_rating' })
  landlordRating!: number;

  @Column({ type: 'smallint', name: 'amenities_rating' })
  amenitiesRating!: number;

  @Column({ type: 'numeric', precision: 3, scale: 2, name: 'average_rating' })
  averageRating!: string;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'timestamptz', name: 'edited_until' })
  editedUntil!: Date;

  @Column({ type: 'text', name: 'landlord_reply', nullable: true })
  landlordReply!: string | null;

  @Column({ type: 'timestamptz', name: 'replied_at', nullable: true })
  repliedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  @ManyToOne(() => Listing, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;

  @ManyToOne(() => Booking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student!: User;
}

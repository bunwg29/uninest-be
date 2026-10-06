import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '@modules/users/entities';
import { Listing } from './listing';

export const LISTING_REPORT_REASONS = [
  'scam',
  'false_information',
  'wrong_price',
  'already_rented',
  'other',
] as const;

export type ListingReportReason = (typeof LISTING_REPORT_REASONS)[number];

@Entity('listing_reports')
@Unique('uq_listing_reports_listing_reporter', ['listingId', 'reporterId'])
export class ListingReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_listing_reports_listing')
  @Column({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @Column({ type: 'uuid', name: 'reporter_id' })
  reporterId!: string;

  @Column({ type: 'varchar', length: 30 })
  reason!: ListingReportReason;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter!: User;
}

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
import { Listing } from '@modules/listings/entities';
import { User } from '@modules/users/entities';

@Entity('comparison_items')
@Unique('uq_comparison_items_user_listing', ['userId', 'listingId'])
export class ComparisonItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_comparison_items_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Index('idx_comparison_items_listing_id')
  @Column({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;
}

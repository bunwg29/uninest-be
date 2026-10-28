import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Listing } from '@modules/listings/entities/listing';
import { User } from '@modules/users/entities';
import { UserBehaviorEventType } from '../constants';

export interface SearchBehaviorFilters {
  minPrice?: number;
  maxPrice?: number;
  roomTypes?: string[];
  amenities?: number[];
  universityCodes?: string[];
}

@Entity('user_behaviors')
@Index('idx_user_behaviors_user_created', ['userId', 'createdAt'])
@Index('uq_user_behaviors_favorite', ['userId', 'listingId'], {
  unique: true,
  where: "event_type = 'favorite'",
})
export class UserBehavior {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 20, name: 'event_type' })
  eventType!: UserBehaviorEventType;

  @Index('idx_user_behaviors_listing')
  @Column({ type: 'uuid', name: 'listing_id', nullable: true })
  listingId!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  keyword!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  filters!: SearchBehaviorFilters | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;
}

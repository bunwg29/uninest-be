import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { User } from '@modules/users/entities';
import { Listing } from './listing';

@Entity('favorites')
@Unique('uq_favorites_user_listing', ['userId', 'listingId'])
export class Favorite {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Index('idx_favorites_listing_id')
  @PrimaryColumn({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Listing, (listing) => listing.favorites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;
}

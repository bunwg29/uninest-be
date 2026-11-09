import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Listing } from '@modules/listings/entities/listing';
import { User } from '@modules/users/entities';

@Entity('user_recommendations')
@Index('idx_user_recommendations_user_rank', ['userId', 'rank'])
export class UserRecommendation {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @Column({ type: 'real' })
  score!: number;

  @Column({ type: 'smallint' })
  rank!: number;

  @Column({ type: 'timestamptz', name: 'computed_at' })
  computedAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;
}

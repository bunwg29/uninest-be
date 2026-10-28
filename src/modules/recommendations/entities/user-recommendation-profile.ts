import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { AI_EMBEDDING_DIMENSIONS } from '@modules/ai-chat/constants';
import { User } from '@modules/users/entities';

@Entity('user_recommendation_profiles')
export class UserRecommendationProfile {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({
    type: 'vector',
    length: AI_EMBEDDING_DIMENSIONS,
    nullable: true,
  })
  embedding!: number[] | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'preferred_province_code',
    nullable: true,
  })
  preferredProvinceCode!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'preferred_ward_code',
    nullable: true,
  })
  preferredWardCode!: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 0,
    name: 'price_min',
    nullable: true,
  })
  priceMin!: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 0,
    name: 'price_max',
    nullable: true,
  })
  priceMax!: string | null;

  @Column({ type: 'integer', name: 'behavior_count', default: 0 })
  behaviorCount!: number;

  @Column({ type: 'integer', name: 'interacted_listing_count', default: 0 })
  interactedListingCount!: number;

  @Column({ type: 'boolean', name: 'is_fallback', default: true })
  isFallback!: boolean;

  @Column({ type: 'timestamptz', name: 'computed_at' })
  computedAt!: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}

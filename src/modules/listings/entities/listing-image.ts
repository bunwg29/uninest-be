import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Listing } from './listing';

@Entity('listing_images')
export class ListingImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_listing_images_listing_id')
  @Column({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @Column({ type: 'varchar', length: 1000 })
  url!: string;

  @Column({ type: 'boolean', name: 'is_cover', default: false })
  isCover!: boolean;

  @Column({ type: 'smallint', name: 'sort_order', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Listing, (listing) => listing.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;
}

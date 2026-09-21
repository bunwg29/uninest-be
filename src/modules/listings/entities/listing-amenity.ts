import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Listing } from './listing';
import { Amenity } from './amenity';

@Entity('listing_amenities')
export class ListingAmenity {
  @PrimaryColumn({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @PrimaryColumn({ type: 'smallint', name: 'amenity_id' })
  amenityId!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Listing, (listing) => listing.listingAmenities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;

  @ManyToOne(() => Amenity, (amenity) => amenity.listingAmenities, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'amenity_id' })
  amenity!: Amenity;
}

import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { ListingAmenity } from './listing-amenity';
import { AmenityGroup } from './amenity-group';

@Entity('amenities')
export class Amenity {
  @PrimaryColumn({ type: 'smallint' })
  id!: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  name!: string;

  @Column({ type: 'smallint', default: AmenityGroup.FURNITURE })
  group!: AmenityGroup;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => ListingAmenity, (listingAmenity) => listingAmenity.amenity)
  listingAmenities!: ListingAmenity[];
}

import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ListingAmenity } from './listing-amenity';

@Entity('amenities')
export class Amenity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  group!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => ListingAmenity, (listingAmenity) => listingAmenity.amenity)
  listingAmenities!: ListingAmenity[];
}

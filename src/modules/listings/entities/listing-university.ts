import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { University } from '@modules/universities/entities/university';
import { Listing } from './listing';

@Entity('listing_universities')
@Index('idx_listing_universities_university', ['universityCode'])
export class ListingUniversity {
  @PrimaryColumn({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @PrimaryColumn({ type: 'varchar', length: 20, name: 'university_code' })
  universityCode!: string;

  @Column({ type: 'smallint', default: 0 })
  position!: number;

  @ManyToOne(() => Listing, (listing) => listing.listingUniversities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listing_id' })
  listing!: Listing;

  @ManyToOne(() => University, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'university_code' })
  university!: University;
}

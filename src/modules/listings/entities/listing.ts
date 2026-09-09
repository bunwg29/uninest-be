import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '@modules/users/entities';
import type { Province, Ward } from '@modules/locations/entities';
import { ListingStatus } from './listing-status';
import { ListingImage } from './listing-image';
import { ListingAmenity } from './listing-amenity';

type ListingPoint = {
  type: 'Point';
  coordinates: [number, number];
};

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_listings_owner_id')
  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId!: string;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 50, name: 'room_type' })
  roomType!: string;

  @Column({ type: 'numeric', precision: 12, scale: 0 })
  price!: string;

  @Column({ type: 'numeric', precision: 8, scale: 2 })
  area!: string;

  @Column({ type: 'smallint', name: 'max_occupants' })
  maxOccupants!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 0,
    nullable: true,
    name: 'electric_price',
  })
  electricPrice!: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 0,
    nullable: true,
    name: 'water_price',
  })
  waterPrice!: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 0,
    nullable: true,
  })
  deposit!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'street_address' })
  streetAddress!: string;

  @Index('idx_listings_province_code')
  @Column({ type: 'varchar', length: 20, name: 'province_code' })
  provinceCode!: string;

  @Index('idx_listings_ward_code')
  @Column({ type: 'varchar', length: 20, name: 'ward_code' })
  wardCode!: string;

  @Column({ type: 'varchar', length: 500, name: 'full_address' })
  fullAddress!: string;

  @Index('idx_listings_location', { spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location!: ListingPoint;

  @Index('idx_listings_status')
  @Column({
    type: 'enum',
    enum: ListingStatus,
    default: ListingStatus.PENDING,
  })
  status!: ListingStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;

  @ManyToOne(() => User, (user) => user.listings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @ManyToOne('Province', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'province_code' })
  province?: Province;

  @ManyToOne('Ward', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ward_code' })
  ward?: Ward;

  @OneToMany(() => ListingImage, (image) => image.listing, { cascade: true })
  images!: ListingImage[];

  @OneToMany(() => ListingAmenity, (listingAmenity) => listingAmenity.listing, {
    cascade: true,
  })
  listingAmenities!: ListingAmenity[];
}

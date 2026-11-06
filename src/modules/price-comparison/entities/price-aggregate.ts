import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { RoomType } from '@modules/listings/entities/room-type';
import { PriceAggregateAreaLevel } from '../constants';

@Entity('price_aggregates')
@Index(
  'uq_price_aggregates_area_room_type',
  ['areaLevel', 'areaCode', 'roomType'],
  { unique: true },
)
@Index('idx_price_aggregates_province_room_type', ['provinceCode', 'roomType'])
export class PriceAggregate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, name: 'area_level' })
  areaLevel!: PriceAggregateAreaLevel;

  @Column({ type: 'varchar', length: 20, name: 'area_code' })
  areaCode!: string;

  @Column({ type: 'varchar', length: 150 })
  area!: string;

  @Column({ type: 'varchar', length: 20, name: 'province_code' })
  provinceCode!: string;

  @Column({ type: 'varchar', length: 50, name: 'room_type' })
  roomType!: RoomType;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 0,
    nullable: true,
    name: 'avg_price',
  })
  avgPrice!: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 0,
    nullable: true,
    name: 'popular_price_min',
  })
  popularPriceMin!: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 0,
    nullable: true,
    name: 'popular_price_max',
  })
  popularPriceMax!: string | null;

  @Column({ type: 'integer', name: 'sample_count' })
  sampleCount!: number;

  @Column({ type: 'timestamptz', name: 'data_from' })
  dataFrom!: Date;

  @Column({ type: 'timestamptz', name: 'data_to' })
  dataTo!: Date;

  @Column({ type: 'timestamptz', name: 'computed_at' })
  computedAt!: Date;
}

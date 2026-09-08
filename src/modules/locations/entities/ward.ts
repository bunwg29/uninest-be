import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Province } from './province';

@Entity('wards')
export class Ward {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 150, name: 'full_name' })
  fullName!: string;

  @Column({ type: 'varchar', length: 100, name: 'code_name' })
  codeName!: string;

  @Index('idx_wards_province_code')
  @Column({ type: 'varchar', length: 20, name: 'province_code' })
  provinceCode!: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'postal_code',
  })
  postalCode!: string | null;

  @ManyToOne('Province', 'wards', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'province_code' })
  province?: Province;
}

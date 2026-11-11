import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('premium_plans')
export class PremiumPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'smallint' })
  months!: number;

  @Column({ type: 'integer' })
  price!: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'smallint', name: 'sort_order', default: 0 })
  sortOrder!: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

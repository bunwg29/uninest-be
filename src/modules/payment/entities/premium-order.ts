import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PremiumOrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
}

@Entity('premium_orders')
@Index('idx_premium_orders_user_created', ['userId', 'createdAt'])
export class PremiumOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 10, name: 'plan_code' })
  planCode!: string;

  @Column({ type: 'smallint' })
  months!: number;

  @Column({ type: 'integer' })
  amount!: number;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'reference_code',
    unique: true,
  })
  referenceCode!: string;

  @Column({
    type: 'varchar',
    length: 10,
    default: PremiumOrderStatus.PENDING,
  })
  status!: PremiumOrderStatus;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'gateway_transaction_id',
    nullable: true,
    unique: true,
  })
  gatewayTransactionId!: string | null;

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

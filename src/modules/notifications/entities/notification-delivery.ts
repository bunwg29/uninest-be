import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NotificationDeliveryStatus {
  PENDING = 'pending',
  TICKETED = 'ticketed',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Entity('notification_deliveries')
@Index(
  'uq_notification_deliveries_notification_token',
  ['notificationId', 'token'],
  {
    unique: true,
  },
)
@Index('idx_notification_deliveries_due', ['status', 'nextAttemptAt'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'notification_id' })
  notificationId!: string;

  @Column({ type: 'varchar', length: 512 })
  token!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: NotificationDeliveryStatus.PENDING,
  })
  status!: NotificationDeliveryStatus;

  @Column({ type: 'varchar', length: 100, name: 'ticket_id', nullable: true })
  ticketId!: string | null;

  @Column({ type: 'timestamptz', name: 'ticketed_at', nullable: true })
  ticketedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({
    type: 'timestamptz',
    name: 'next_attempt_at',
    default: () => 'now()',
  })
  nextAttemptAt!: Date;

  @Column({ type: 'timestamptz', name: 'lease_until', nullable: true })
  leaseUntil!: Date | null;

  @Column({ type: 'varchar', length: 80, name: 'last_error', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

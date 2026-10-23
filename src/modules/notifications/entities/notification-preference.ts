import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'boolean', name: 'new_listings', default: true })
  newListings!: boolean;

  @Column({ type: 'boolean', name: 'messages', default: true })
  messages!: boolean;

  @Column({ type: 'boolean', name: 'reminders', default: true })
  reminders!: boolean;

  @Column({ type: 'boolean', name: 'system', default: true })
  system!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PushPlatform {
  ANDROID = 'android',
  IOS = 'ios',
}

@Entity('push_devices')
@Index('idx_push_devices_user', ['userId'])
export class PushDevice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 512, unique: true })
  token!: string;

  @Column({ type: 'enum', enum: PushPlatform })
  platform!: PushPlatform;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_refresh_tokens_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Index('idx_refresh_tokens_hash', { unique: true })
  @Column({ type: 'varchar', length: 64, unique: true, name: 'token_hash' })
  tokenHash!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'device_name',
  })
  deviceName!: string | null;

  @Index('idx_refresh_tokens_device_id')
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'device_id',
  })
  deviceId!: string | null;

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
    name: 'ip_address',
  })
  ipAddress!: string | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Index('idx_refresh_tokens_revoked')
  @Column({ type: 'boolean', default: false, name: 'is_revoked' })
  isRevoked!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.refreshTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}

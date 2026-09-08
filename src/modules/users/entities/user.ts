import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserRoleType } from '@common/constants';
import { Role } from './role';
import type { RefreshToken } from '../../auth/entities/refresh-token';
import type { Province, Ward } from '../../locations/entities';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_users_email', { unique: true, where: 'email IS NOT NULL' })
  @Column({ type: 'varchar', length: 150, unique: true, nullable: true })
  email!: string | null;

  @Index('idx_users_phone', { unique: true, where: 'phone IS NOT NULL' })
  @Column({ type: 'varchar', length: 15, unique: true, nullable: true })
  phone!: string | null;

  @Column({
    type: 'varchar',
    length: 72,
    nullable: true,
    name: 'password_hash',
    select: false,
  })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 70, name: 'full_name' })
  fullName!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'avatar_url',
  })
  avatarUrl!: string | null;

  @Index('idx_users_role_id')
  @Column({
    type: 'smallint',
    name: 'role_id',
    default: UserRoleType.STUDENT,
  })
  roleId!: UserRoleType;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', name: 'is_verified', default: false })
  isVerified!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'province_code',
  })
  provinceCode!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'ward_code',
  })
  wardCode!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'street_address',
  })
  streetAddress!: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    name: 'full_address',
  })
  fullAddress!: string | null;

  @ManyToOne('Province', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'province_code' })
  province?: Province;

  @ManyToOne('Ward', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ward_code' })
  ward?: Ward;

  @ManyToOne(() => Role, (role) => role.users)
  @JoinColumn({ name: 'role_id' })
  role?: Role;

  @OneToMany('RefreshToken', 'user')
  refreshTokens?: RefreshToken[];
}

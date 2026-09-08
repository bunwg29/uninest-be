import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum OtpType {
  REGISTER = 'REGISTER',
  LOGIN = 'LOGIN',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
}

@Entity('otp_codes')
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_otp_codes_identifier')
  @Column({ type: 'varchar', length: 150 })
  identifier!: string;

  @Column({ type: 'varchar', length: 6 })
  code!: string;

  @Column({ type: 'varchar', length: 20, default: OtpType.REGISTER })
  type!: OtpType;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Index('idx_otp_codes_is_used')
  @Column({ type: 'boolean', default: false, name: 'is_used' })
  isUsed!: boolean;

  @Column({ type: 'smallint', default: 0 })
  attempts!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

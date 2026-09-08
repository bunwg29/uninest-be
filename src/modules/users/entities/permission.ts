import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RolePermission } from './role-permission';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    type: 'smallint',
  })
  id!: number;

  @Index('idx_permissions_code', { unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 70 })
  name!: string;

  @Index('idx_permissions_module')
  @Column({ type: 'varchar', length: 30 })
  module!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  description!: string | null;

  @OneToMany(() => RolePermission, (rp) => rp.permission)
  rolePermissions!: RolePermission[];
}

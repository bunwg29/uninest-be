import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { UserRoleType } from '@common/constants';
import { User } from './user';
import { RolePermission } from './role-permission';

@Entity('roles')
export class Role {
  @PrimaryColumn({ type: 'smallint' })
  id!: UserRoleType;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  description!: string | null;

  @OneToMany(() => User, (user) => user.role)
  users!: User[];

  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions!: RolePermission[];
}

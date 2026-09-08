import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role';
import { Permission } from './permission';
import { UserRoleType } from '@common/constants';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({ type: 'smallint', name: 'role_id' })
  roleId!: UserRoleType;

  @PrimaryColumn({ type: 'smallint', name: 'permission_id' })
  permissionId!: number;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;
}

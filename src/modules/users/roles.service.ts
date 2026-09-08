import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, Permission, RolePermission } from './entities';
import { UserRoleType } from '@common/constants';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: {
        rolePermissions: {
          permission: true,
        },
      },
      order: { id: 'ASC' },
    });
  }

  async findRoleById(id: UserRoleType): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: {
        rolePermissions: {
          permission: true,
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find({
      order: { module: 'ASC', code: 'ASC' },
    });
  }

  async getPermissionsForRole(roleId: UserRoleType): Promise<string[]> {
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId },
      relations: {
        permission: true,
      },
    });

    return rolePermissions
      .map((rp) => rp.permission?.code)
      .filter((code): code is string => Boolean(code));
  }

  async assignPermissionToRole(
    roleId: UserRoleType,
    permissionId: number,
  ): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });

    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new NotFoundException(
        `Permission with ID ${permissionId} not found`,
      );
    }

    const existing = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });

    if (existing) {
      throw new ConflictException(
        `Permission ${permission.code} is already assigned to role ${role.code}`,
      );
    }

    const rolePermission = this.rolePermissionRepository.create({
      roleId,
      permissionId,
    });

    await this.rolePermissionRepository.save(rolePermission);
  }

  async removePermissionFromRole(
    roleId: UserRoleType,
    permissionId: number,
  ): Promise<void> {
    const result = await this.rolePermissionRepository.delete({
      roleId,
      permissionId,
    });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Permission assignment not found for role ${roleId} and permission ${permissionId}`,
      );
    }
  }
}

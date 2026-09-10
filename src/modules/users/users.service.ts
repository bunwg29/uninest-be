import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, RolePermission } from './entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: { role: true },
    });
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: { role: true },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { phone: phone.trim() },
      relations: { role: true },
    });
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes('@');

    const query = this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role');

    if (isEmail) {
      query.where('LOWER(user.email) = LOWER(:identifier)', {
        identifier: trimmed,
      });
    } else {
      query.where('user.phone = :identifier', { identifier: trimmed });
    }

    return query.getOne();
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create({
      ...data,
      email: data.email ? data.email.toLowerCase().trim() : null,
      phone: data.phone ? data.phone.trim() : null,
    });

    return this.userRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với mã ${id}`);
    }

    Object.assign(user, data);

    return this.userRepository.save(user);
  }

  async markVerified(id: string): Promise<void> {
    await this.userRepository.update(id, { isVerified: true });
  }

  async markPhoneVerified(id: string): Promise<void> {
    await this.userRepository.update(id, { phoneVerified: true });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.userRepository.update(id, { passwordHash });
  }

  async getUserPermissions(roleId: number): Promise<string[]> {
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId },
      relations: { permission: true },
    });

    return rolePermissions
      .map((rp) => rp.permission?.code)
      .filter((code): code is string => Boolean(code));
  }
}

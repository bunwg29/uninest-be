import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ACTIVE_BOOKING_STATUSES, Booking } from '@modules/booking';
import { Favorite } from '@modules/listings/entities';
import { User, RolePermission } from './entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getProfileStats(userId: string) {
    const [savedRooms, appointments] = await Promise.all([
      this.dataSource.getRepository(Favorite).count({ where: { userId } }),
      this.dataSource.getRepository(Booking).count({
        where: { userId, status: In(ACTIVE_BOOKING_STATUSES) },
      }),
    ]);

    return { savedRooms, appointments, reviews: 0 };
  }

  async completeLandlordVerification(
    userId: string,
    dto: {
      identityNumber: string;
      provinceCode?: string;
      wardCode?: string;
      streetAddress?: string;
    },
  ): Promise<User> {
    await this.userRepository.update(userId, {
      identityNumber: dto.identityNumber,
      ...(dto.provinceCode ? { provinceCode: dto.provinceCode } : {}),
      ...(dto.wardCode ? { wardCode: dto.wardCode } : {}),
      ...(dto.streetAddress ? { streetAddress: dto.streetAddress.trim() } : {}),
      landlordVerifiedAt: new Date(),
    });

    const user = await this.findById(userId);

    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');

    return user;
  }

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

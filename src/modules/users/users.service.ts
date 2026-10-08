import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ACTIVE_BOOKING_STATUSES, Booking } from '@modules/booking';
import { Favorite, ListingStatus } from '@modules/listings/entities';
import { UserRoleType } from '@common/constants';
import { LocationsService } from '../locations/locations.service';
import {
  UniversitiesService,
  type UniversitySummary,
} from '../universities/universities.service';
import { User, RolePermission } from './entities';

const STUDENT_UNIVERSITY_LIMIT = 1;

type AddressUpdate = Partial<
  Pick<User, 'provinceCode' | 'wardCode' | 'streetAddress' | 'fullAddress'>
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly locationsService: LocationsService,
    private readonly universitiesService: UniversitiesService,
  ) {}

  async getProfileStats(userId: string) {
    const [savedRooms, appointments] = await Promise.all([
      this.dataSource
        .getRepository(Favorite)
        .createQueryBuilder('favorite')
        .innerJoin('favorite.listing', 'listing')
        .where('favorite.userId = :userId', { userId })
        .andWhere('listing.status = :activeStatus', {
          activeStatus: ListingStatus.ACTIVE,
        })
        .andWhere('listing.deletedAt IS NULL')
        .getCount(),
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
    const address = await this.resolveAddress(dto);

    await this.userRepository.update(userId, {
      identityNumber: dto.identityNumber,
      ...address,
      landlordVerifiedAt: new Date(),
    });

    const user = await this.findProfileById(userId);

    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');

    return user;
  }

  async resolveAddress(dto: {
    provinceCode?: string;
    wardCode?: string;
    streetAddress?: string;
  }): Promise<AddressUpdate> {
    if (!dto.provinceCode && !dto.wardCode && !dto.streetAddress) return {};

    if (!dto.provinceCode || !dto.wardCode) {
      throw new BadRequestException(
        'Vui lòng chọn đầy đủ tỉnh/thành phố và phường/xã',
      );
    }

    const ward = await this.locationsService.getWardByCode(dto.wardCode);

    if (ward.provinceCode !== dto.provinceCode) {
      throw new BadRequestException(
        'Phường/xã không thuộc tỉnh/thành phố đã chọn',
      );
    }

    const streetAddress = dto.streetAddress?.trim() || null;

    return {
      provinceCode: dto.provinceCode,
      wardCode: dto.wardCode,
      streetAddress,
      fullAddress: await this.locationsService.formatFullAddress(
        dto.provinceCode,
        dto.wardCode,
        streetAddress,
      ),
    };
  }

  async assertUniversitiesExist(codes: string[]): Promise<void> {
    await this.universitiesService.assertCodesExist(codes);
  }

  getUniversities(userId: string): Promise<UniversitySummary[]> {
    return this.universitiesService.getUserUniversities(userId);
  }

  async updateUniversities(
    user: Pick<User, 'id' | 'roleId'>,
    codes: string[],
  ): Promise<UniversitySummary[]> {
    if (user.roleId !== UserRoleType.STUDENT && codes.length > 0) {
      throw new BadRequestException(
        'Chủ trọ chọn trường đại học gần phòng khi đăng tin',
      );
    }

    const universities = await this.universitiesService.replaceUserUniversities(
      user.id,
      codes,
      STUDENT_UNIVERSITY_LIMIT,
    );

    await this.userRepository.update(user.id, {
      school: universities[0]?.name ?? null,
    });

    return universities;
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: { role: true },
    });
  }

  async findProfileById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: { role: true, province: true, ward: true },
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
      query.where('user.email = :identifier', {
        identifier: trimmed.toLowerCase(),
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

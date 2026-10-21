import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { UserRoleType } from '@common/constants';
import { createPaginatedResult } from '@common/dtos';
import { escapeLikePattern } from '@common/utils';
import { RefreshToken } from '@modules/auth/entities/refresh-token';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { AdminUsersQueryDto } from '../dtos';
import { Report, ReportEntityType } from '../entities';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AdminAuditService,
  ) {}

  async list(query: AdminUsersQueryDto) {
    const builder = this.repository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.roleId !== undefined) {
      builder.andWhere('user.roleId = :roleId', { roleId: query.roleId });
    }

    if (query.keyword?.trim()) {
      const keyword = `%${escapeLikePattern(query.keyword.trim())}%`;

      builder.andWhere(
        new Brackets((where) => {
          where.where('user.fullName ILIKE :keyword', { keyword });
          where.orWhere('user.email ILIKE :keyword', { keyword });
          where.orWhere('user.phone ILIKE :keyword', { keyword });
        }),
      );
    }

    const [users, total] = await builder.getManyAndCount();

    return createPaginatedResult(
      users.map((user) => this.toSafeUser(user)),
      total,
      query.page,
      query.limit,
    );
  }

  async getDetail(id: string) {
    const user = await this.repository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const [listingCount, reportCount] = await Promise.all([
      this.dataSource.getRepository(Listing).count({ where: { ownerId: id } }),
      this.dataSource
        .getRepository(Report)
        .count({ where: { entityType: ReportEntityType.USER, entityId: id } }),
    ]);

    return { ...this.toSafeUser(user), listingCount, reportCount };
  }

  async setLocked(
    actorId: string,
    id: string,
    locked: boolean,
    reason: string,
  ) {
    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      throw new BadRequestException('Vui lòng nhập lý do');
    }

    if (actorId === id) {
      throw new BadRequestException(
        'Bạn không thể khoá tài khoản của chính mình',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('Không tìm thấy tài khoản');
      }

      if (user.roleId === UserRoleType.ADMIN) {
        throw new BadRequestException('Không thể khoá tài khoản quản trị viên');
      }

      if (user.isActive === !locked) {
        throw new ConflictException('Trạng thái tài khoản không thay đổi');
      }

      await manager.update(User, id, { isActive: !locked });

      if (locked) {
        await manager.update(
          RefreshToken,
          { userId: id, isRevoked: false },
          { isRevoked: true },
        );

        if (user.roleId === UserRoleType.LANDLORD) {
          await manager.update(
            Listing,
            { ownerId: id, status: ListingStatus.ACTIVE },
            { status: ListingStatus.HIDDEN },
          );
        }
      }

      await this.auditService.record(
        manager,
        actorId,
        locked ? 'user.lock' : 'user.unlock',
        'user',
        id,
        normalizedReason,
      );

      return { id, isActive: !locked };
    });
  }

  private toSafeUser(user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      isActive: user.isActive,
      isVerified: user.isVerified,
      landlordVerifiedAt: user.landlordVerifiedAt,
      createdAt: user.createdAt,
    };
  }
}

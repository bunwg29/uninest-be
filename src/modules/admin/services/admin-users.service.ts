import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { UserRoleType } from '@common/constants';
import { createPaginatedResult } from '@common/dtos';
import { escapeLikePattern } from '@common/utils';
import { R2StorageService } from '@core/storage';
import { RefreshToken } from '@modules/auth/entities/refresh-token';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { AdminUserSort, AdminUserStatus, AdminUsersQueryDto } from '../dtos';
import { AuditLog } from '../entities';
import { AdminAuditService } from './admin-audit.service';

interface ActivityRow {
  id: string;
  listing_count: string;
  active_count: string;
  rejected_count: string;
  report_count: string;
  booking_count: string;
}

interface RelatedReportRow {
  id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  status: string;
  created_at: Date;
}

const ownedReportsSql = (ownerRef: string) => `
  FROM reports report
  LEFT JOIN listings listing ON report.entity_type = 'listing' AND listing.id = report.entity_id
  LEFT JOIN forum_posts post ON report.entity_type = 'forum_post' AND post.id = report.entity_id
  LEFT JOIN forum_comments comment ON report.entity_type = 'forum_comment' AND comment.id = report.entity_id
  WHERE listing.owner_id = ${ownerRef} OR post.author_id = ${ownerRef} OR comment.author_id = ${ownerRef} OR (report.entity_type = 'user' AND report.entity_id = ${ownerRef})`;

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AdminAuditService,
    private readonly storageService: R2StorageService,
  ) {}

  async list(query: AdminUsersQueryDto) {
    const builder = this.repository
      .createQueryBuilder('user')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.sort === AdminUserSort.NAME) {
      builder.orderBy('user.fullName', 'ASC');
    } else {
      builder.orderBy(
        'user.createdAt',
        query.sort === AdminUserSort.OLDEST ? 'ASC' : 'DESC',
      );
    }

    builder.addOrderBy('user.id', 'DESC');

    if (query.roleId !== undefined) {
      builder.andWhere('user.roleId = :roleId', { roleId: query.roleId });
    }

    if (query.status) {
      builder.andWhere('user.isActive = :isActive', {
        isActive: query.status === AdminUserStatus.ACTIVE,
      });
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

    const [[users, total], counts] = await Promise.all([
      builder.getManyAndCount(),
      this.getCounts(),
    ]);
    const activity = await this.getActivity(users.map((user) => user.id));

    return {
      ...createPaginatedResult(
        users.map((user) => ({
          ...this.toSafeUser(user),
          ...this.toActivity(activity.get(user.id)),
        })),
        total,
        query.page,
        query.limit,
      ),
      counts,
    };
  }

  async getDetail(id: string) {
    const user = await this.repository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const [activity, listings, reports, lastLogin] = await Promise.all([
      this.getActivity([id]),
      this.dataSource.getRepository(Listing).find({
        where: { ownerId: id },
        relations: { images: true },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.dataSource.query<RelatedReportRow[]>(
        `SELECT report.id, report.entity_type, report.entity_id, report.reason, report.status, report.created_at
        ${ownedReportsSql('$1')}
        ORDER BY report.created_at DESC
        LIMIT 5`,
        [id],
      ),
      this.dataSource.getRepository(RefreshToken).findOne({
        where: { userId: id },
        order: { createdAt: 'DESC' },
      }),
    ]);
    const listingIds = listings.map((listing) => listing.id);
    const history = await this.dataSource.getRepository(AuditLog).find({
      where: listingIds.length
        ? [{ entityId: id }, { entityId: In(listingIds) }]
        : { entityId: id },
      order: { createdAt: 'DESC' },
      take: 8,
    });

    return {
      ...this.toSafeUser(user),
      ...this.toActivity(activity.get(id)),
      phoneVerified: user.phoneVerified,
      identitySubmitted: user.identityNumber !== null,
      lastLoginAt: lastLogin?.createdAt ?? null,
      listings: listings.map((listing) => {
        const cover =
          listing.images?.find((image) => image.isCover) ?? listing.images?.[0];

        return {
          id: listing.id,
          title: listing.title,
          status: listing.status,
          createdAt: listing.createdAt,
          coverUrl: cover ? this.storageService.getPublicUrl(cover.url) : null,
        };
      }),
      reports: reports.map((report) => ({
        id: report.id,
        entityType: report.entity_type,
        entityId: report.entity_id,
        reason: report.reason,
        status: report.status,
        createdAt: report.created_at,
      })),
      history: history.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        reason: entry.reason,
        createdAt: entry.createdAt,
      })),
    };
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

  private async getCounts() {
    const [row] = await this.dataSource.query<
      {
        all: string;
        students: string;
        landlords: string;
        admins: string;
        locked: string;
      }[]
    >(
      `SELECT
        COUNT(*) AS all,
        COUNT(*) FILTER (WHERE role_id = $1) AS students,
        COUNT(*) FILTER (WHERE role_id = $2) AS landlords,
        COUNT(*) FILTER (WHERE role_id = $3) AS admins,
        COUNT(*) FILTER (WHERE is_active = false) AS locked
      FROM users`,
      [UserRoleType.STUDENT, UserRoleType.LANDLORD, UserRoleType.ADMIN],
    );

    return {
      all: Number(row?.all ?? 0),
      students: Number(row?.students ?? 0),
      landlords: Number(row?.landlords ?? 0),
      admins: Number(row?.admins ?? 0),
      locked: Number(row?.locked ?? 0),
    };
  }

  private async getActivity(ids: string[]) {
    if (ids.length === 0) return new Map<string, ActivityRow>();

    const rows = await this.dataSource.query<ActivityRow[]>(
      `SELECT owner.id,
        (SELECT COUNT(*) FROM listings item WHERE item.owner_id = owner.id AND item.deleted_at IS NULL) AS listing_count,
        (SELECT COUNT(*) FROM listings item WHERE item.owner_id = owner.id AND item.deleted_at IS NULL AND item.status = $2) AS active_count,
        (SELECT COUNT(*) FROM listings item WHERE item.owner_id = owner.id AND item.deleted_at IS NULL AND item.status = $3) AS rejected_count,
        (SELECT COUNT(DISTINCT (report.entity_type, report.entity_id)) ${ownedReportsSql('owner.id')}) AS report_count,
        (SELECT COUNT(*) FROM bookings booking WHERE booking.user_id = owner.id) AS booking_count
      FROM users owner
      WHERE owner.id = ANY($1)`,
      [ids, ListingStatus.ACTIVE, ListingStatus.REJECTED],
    );

    return new Map(rows.map((row) => [row.id, row]));
  }

  private toActivity(row?: ActivityRow) {
    return {
      listingCount: Number(row?.listing_count ?? 0),
      activeListingCount: Number(row?.active_count ?? 0),
      rejectedListingCount: Number(row?.rejected_count ?? 0),
      reportCount: Number(row?.report_count ?? 0),
      bookingCount: Number(row?.booking_count ?? 0),
    };
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

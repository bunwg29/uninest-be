import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { UserRoleType } from '@common/constants';
import { createPaginatedResult } from '@common/dtos';
import { escapeLikePattern } from '@common/utils';
import { R2StorageService } from '@core/storage';
import { LISTING_EVENTS } from '@modules/listings/constants';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { ListingsService } from '@modules/listings/services/listings.service';
import {
  AdminListingFlag,
  AdminListingsQueryDto,
  AdminSortOrder,
} from '../dtos';
import { Report, ReportEntityType, ReportStatus } from '../entities';
import { AdminAuditService } from './admin-audit.service';

export type AdminListingWarning = 'owner_unverified' | 'reported';

@Injectable()
export class AdminListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly repository: Repository<Listing>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly listingsService: ListingsService,
    private readonly auditService: AdminAuditService,
    private readonly storageService: R2StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(query: AdminListingsQueryDto) {
    const builder = this.repository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.owner', 'owner')
      .leftJoinAndSelect('listing.ward', 'ward')
      .leftJoinAndSelect('listing.images', 'image', 'image.isCover = true')
      .orderBy(
        'listing.createdAt',
        query.sort === AdminSortOrder.OLDEST ? 'ASC' : 'DESC',
      )
      .addOrderBy('listing.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.status) {
      builder.andWhere('listing.status = :status', { status: query.status });
    }

    if (query.flag === AdminListingFlag.WARNING) {
      this.whereWarning(builder);
    }

    if (query.provinceCode) {
      builder.andWhere('listing.provinceCode = :provinceCode', {
        provinceCode: query.provinceCode,
      });
    }

    if (query.keyword?.trim()) {
      const keyword = `%${escapeLikePattern(query.keyword.trim())}%`;

      builder.andWhere(
        new Brackets((where) => {
          where.where('listing.title ILIKE :keyword', { keyword });
          where.orWhere('CAST(listing.id AS text) ILIKE :keyword', { keyword });
          where.orWhere('owner.fullName ILIKE :keyword', { keyword });
        }),
      );
    }

    const [[listings, total], counts] = await Promise.all([
      builder.getManyAndCount(),
      this.getCounts(),
    ]);
    const reportCounts = await this.countPendingReports(
      listings.map((listing) => listing.id),
    );
    const items = listings.map((listing) => {
      const reportCount = reportCounts.get(listing.id) ?? 0;
      const warnings: AdminListingWarning[] = [];
      const cover = listing.images?.[0];

      if (!listing.owner.landlordVerifiedAt) warnings.push('owner_unverified');

      if (reportCount > 0) warnings.push('reported');

      return {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        price: listing.price,
        area: listing.area,
        fullAddress: listing.fullAddress,
        wardName: listing.ward?.name ?? null,
        viewCount: listing.viewCount,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        owner: {
          id: listing.owner.id,
          fullName: listing.owner.fullName,
          isVerified: listing.owner.isVerified,
          landlordVerifiedAt: listing.owner.landlordVerifiedAt,
        },
        coverUrl: cover ? this.storageService.getPublicUrl(cover.url) : null,
        moderationHidden: listing.moderationHiddenAt !== null,
        moderationReason: listing.moderationReason,
        reportCount,
        warnings,
      };
    });

    return {
      ...createPaginatedResult(items, total, query.page, query.limit),
      counts,
    };
  }

  async listProvinces() {
    const rows = await this.repository
      .createQueryBuilder('listing')
      .innerJoin('listing.province', 'province')
      .select('province.code', 'code')
      .addSelect('province.name', 'name')
      .addSelect('COUNT(listing.id)', 'count')
      .groupBy('province.code')
      .addGroupBy('province.name')
      .orderBy('COUNT(listing.id)', 'DESC')
      .getRawMany<{ code: string; name: string; count: string }>();

    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      listingCount: Number(row.count),
    }));
  }

  getDetail(actorId: string, id: string) {
    return this.listingsService.getListingDetail(
      actorId,
      UserRoleType.ADMIN,
      id,
    );
  }

  async approve(actorId: string, id: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const pending = await manager.findOne(Listing, {
        where: { id, status: ListingStatus.PENDING },
        relations: { owner: true },
      });

      if (pending && !pending.owner.isActive) {
        throw new BadRequestException(
          'Tài khoản chủ trọ đang bị khoá, không thể duyệt tin',
        );
      }

      const updated = await manager.update(
        Listing,
        { id, status: ListingStatus.PENDING },
        {
          status: ListingStatus.ACTIVE,
          rejectionReason: null,
          moderationHiddenAt: null,
          moderationReason: null,
        },
      );

      if (!updated.affected) {
        await this.assertExists(manager.getRepository(Listing), id);
        throw new ConflictException('Tin đăng đã được xử lý');
      }

      const listing = await manager.findOneByOrFail(Listing, { id });
      const audit = await this.auditService.record(
        manager,
        actorId,
        'listing.approve',
        'listing',
        id,
        'Duyệt tin đăng chờ kiểm duyệt',
      );

      return {
        id,
        status: ListingStatus.ACTIVE,
        ownerId: listing.ownerId,
        auditId: audit.id,
      };
    });

    this.eventEmitter.emit(LISTING_EVENTS.ACTIVATED, { listingId: id });

    this.eventEmitter.emit(LISTING_EVENTS.REVIEWED, {
      listingId: id,
      ownerId: result.ownerId,
      status: result.status,
      auditId: result.auditId,
    });

    return { id: result.id, status: result.status };
  }

  async reject(actorId: string, id: string, reason: string) {
    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const updated = await manager.update(
        Listing,
        { id, status: ListingStatus.PENDING },
        { status: ListingStatus.REJECTED, rejectionReason: normalizedReason },
      );

      if (!updated.affected) {
        await this.assertExists(manager.getRepository(Listing), id);
        throw new ConflictException('Tin đăng đã được xử lý');
      }

      const listing = await manager.findOneByOrFail(Listing, { id });
      const audit = await this.auditService.record(
        manager,
        actorId,
        'listing.reject',
        'listing',
        id,
        normalizedReason,
      );

      return {
        id,
        status: ListingStatus.REJECTED,
        reason: normalizedReason,
        ownerId: listing.ownerId,
        auditId: audit.id,
      };
    });

    this.eventEmitter.emit(LISTING_EVENTS.REVIEWED, {
      listingId: id,
      ownerId: result.ownerId,
      status: result.status,
      reason: result.reason,
      auditId: result.auditId,
    });

    return { id: result.id, status: result.status, reason: result.reason };
  }

  async hide(actorId: string, id: string, reason: string) {
    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      throw new BadRequestException('Vui lòng nhập lý do ẩn tin');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const updated = await manager.update(
        Listing,
        { id, status: ListingStatus.ACTIVE },
        {
          status: ListingStatus.HIDDEN,
          moderationHiddenAt: new Date(),
          moderationReason: normalizedReason,
        },
      );

      if (!updated.affected) {
        await this.assertExists(manager.getRepository(Listing), id);
        throw new ConflictException('Chỉ ẩn được tin đang hiển thị');
      }

      const listing = await manager.findOneByOrFail(Listing, { id });
      const audit = await this.auditService.record(
        manager,
        actorId,
        'listing.hide',
        'listing',
        id,
        normalizedReason,
      );

      return { ownerId: listing.ownerId, auditId: audit.id };
    });

    this.eventEmitter.emit(LISTING_EVENTS.AVAILABILITY_CHANGED, {
      listingId: id,
    });
    this.eventEmitter.emit(LISTING_EVENTS.REVIEWED, {
      listingId: id,
      ownerId: result.ownerId,
      status: ListingStatus.HIDDEN,
      reason: normalizedReason,
      auditId: result.auditId,
    });

    return { id, status: ListingStatus.HIDDEN };
  }

  async restore(actorId: string, id: string, reason: string) {
    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      throw new BadRequestException('Vui lòng nhập lý do hiện lại tin');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Listing, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!listing) {
        throw new NotFoundException('Không tìm thấy tin đăng');
      }

      const owner = await manager.findOneByOrFail(User, {
        id: listing.ownerId,
      });

      if (
        listing.status !== ListingStatus.HIDDEN ||
        listing.moderationHiddenAt === null
      ) {
        throw new ConflictException(
          'Chỉ hiện lại được tin do quản trị viên ẩn',
        );
      }

      if (!owner.isActive) {
        throw new BadRequestException(
          'Tài khoản chủ trọ đang bị khoá, không thể hiện lại tin',
        );
      }

      await manager.update(
        Listing,
        { id },
        {
          status: ListingStatus.ACTIVE,
          moderationHiddenAt: null,
          moderationReason: null,
        },
      );

      const audit = await this.auditService.record(
        manager,
        actorId,
        'listing.restore',
        'listing',
        id,
        normalizedReason,
      );

      return { ownerId: listing.ownerId, auditId: audit.id };
    });

    this.eventEmitter.emit(LISTING_EVENTS.ACTIVATED, { listingId: id });
    this.eventEmitter.emit(LISTING_EVENTS.AVAILABILITY_CHANGED, {
      listingId: id,
    });
    this.eventEmitter.emit(LISTING_EVENTS.REVIEWED, {
      listingId: id,
      ownerId: result.ownerId,
      status: ListingStatus.ACTIVE,
      auditId: result.auditId,
    });

    return { id, status: ListingStatus.ACTIVE };
  }

  private async getCounts() {
    const pending = () =>
      this.repository
        .createQueryBuilder('listing')
        .leftJoin('listing.owner', 'owner')
        .where('listing.status = :pending', { pending: ListingStatus.PENDING });
    const [rows, warning] = await Promise.all([
      this.repository
        .createQueryBuilder('listing')
        .select('listing.status', 'status')
        .addSelect('COUNT(listing.id)', 'count')
        .groupBy('listing.status')
        .getRawMany<{ status: ListingStatus; count: string }>(),
      this.whereWarning(pending()).getCount(),
    ]);
    const byStatus = Object.fromEntries(
      Object.values(ListingStatus).map((status) => [status, 0]),
    ) as Record<ListingStatus, number>;

    rows.forEach((row) => {
      byStatus[row.status] = Number(row.count);
    });

    return { ...byStatus, warning };
  }

  private whereWarning(builder: SelectQueryBuilder<Listing>) {
    return builder.andWhere(
      new Brackets((where) => {
        where.where('owner.landlordVerifiedAt IS NULL');
        where.orWhere(
          `EXISTS (SELECT 1 FROM reports warning_report WHERE warning_report.entity_type = :warningEntity AND warning_report.entity_id = listing.id AND warning_report.status = :warningStatus)`,
          {
            warningEntity: ReportEntityType.LISTING,
            warningStatus: ReportStatus.PENDING,
          },
        );
      }),
    );
  }

  private async countPendingReports(ids: string[]) {
    if (ids.length === 0) return new Map<string, number>();

    const rows = await this.dataSource
      .getRepository(Report)
      .createQueryBuilder('report')
      .select('report.entityId', 'entityId')
      .addSelect('COUNT(report.id)', 'count')
      .where('report.entityType = :entityType', {
        entityType: ReportEntityType.LISTING,
      })
      .andWhere('report.status = :status', { status: ReportStatus.PENDING })
      .andWhere({ entityId: In(ids) })
      .groupBy('report.entityId')
      .getRawMany<{ entityId: string; count: string }>();

    return new Map(rows.map((row) => [row.entityId, Number(row.count)]));
  }

  private async assertExists(repository: Repository<Listing>, id: string) {
    const exists = await repository.existsBy({ id });

    if (!exists) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
  }
}

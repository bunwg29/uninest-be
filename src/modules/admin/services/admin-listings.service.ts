import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { UserRoleType } from '@common/constants';
import { createPaginatedResult } from '@common/dtos';
import { escapeLikePattern } from '@common/utils';
import { LISTING_EVENTS } from '@modules/listings/constants';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { ListingsService } from '@modules/listings/services/listings.service';
import { AdminListingsQueryDto } from '../dtos';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly repository: Repository<Listing>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly listingsService: ListingsService,
    private readonly auditService: AdminAuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(query: AdminListingsQueryDto) {
    const builder = this.repository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.owner', 'owner')
      .leftJoinAndSelect('listing.images', 'image')
      .orderBy('listing.createdAt', 'DESC')
      .addOrderBy('listing.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    if (query.status) {
      builder.andWhere('listing.status = :status', { status: query.status });
    }

    if (query.keyword?.trim()) {
      const keyword = `%${escapeLikePattern(query.keyword.trim())}%`;

      builder.andWhere(
        new Brackets((where) => {
          where.where('listing.title ILIKE :keyword', { keyword });
          where.orWhere('CAST(listing.id AS text) ILIKE :keyword', { keyword });
        }),
      );
    }

    const [listings, total] = await builder.getManyAndCount();
    const items = listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      price: listing.price,
      area: listing.area,
      fullAddress: listing.fullAddress,
      createdAt: listing.createdAt,
      owner: {
        id: listing.owner.id,
        fullName: listing.owner.fullName,
        isVerified: listing.owner.isVerified,
        landlordVerifiedAt: listing.owner.landlordVerifiedAt,
      },
      coverKey: listing.images.find((image) => image.isCover)?.url ?? null,
    }));

    return createPaginatedResult(items, total, query.page, query.limit);
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
      const updated = await manager.update(
        Listing,
        { id, status: ListingStatus.PENDING },
        { status: ListingStatus.ACTIVE, rejectionReason: null },
      );

      if (!updated.affected) {
        await this.assertPending(manager.getRepository(Listing), id);
        throw new ConflictException('Tin đăng đã được xử lý');
      }

      await this.auditService.record(
        manager,
        actorId,
        'listing.approve',
        'listing',
        id,
        'Duyệt tin đăng chờ kiểm duyệt',
      );

      return { id, status: ListingStatus.ACTIVE };
    });

    this.eventEmitter.emit(LISTING_EVENTS.ACTIVATED, { listingId: id });

    return result;
  }

  async reject(actorId: string, id: string, reason: string) {
    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }

    return this.dataSource.transaction(async (manager) => {
      const updated = await manager.update(
        Listing,
        { id, status: ListingStatus.PENDING },
        { status: ListingStatus.REJECTED, rejectionReason: normalizedReason },
      );

      if (!updated.affected) {
        await this.assertPending(manager.getRepository(Listing), id);
        throw new ConflictException('Tin đăng đã được xử lý');
      }

      await this.auditService.record(
        manager,
        actorId,
        'listing.reject',
        'listing',
        id,
        normalizedReason,
      );

      return { id, status: ListingStatus.REJECTED, reason: normalizedReason };
    });
  }

  private async assertPending(repository: Repository<Listing>, id: string) {
    const exists = await repository.existsBy({ id });

    if (!exists) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
  }
}

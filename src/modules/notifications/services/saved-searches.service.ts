import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createPaginatedResult } from '@common/dtos';
import {
  LISTING_EVENTS,
  type ListingActivatedPayload,
} from '@modules/listings/constants';
import { Listing, ListingStatus } from '@modules/listings/entities';
import {
  CreateSavedSearchDto,
  NotificationQueryDto,
  UpdateSavedSearchDto,
} from '../dtos';
import { NotificationType, SavedSearch } from '../entities';
import { NotificationQueueService } from './notification-queue.service';

@Injectable()
export class SavedSearchesService {
  constructor(
    @InjectRepository(SavedSearch)
    private readonly searches: Repository<SavedSearch>,
    @InjectRepository(Listing)
    private readonly listings: Repository<Listing>,
    private readonly queue: NotificationQueueService,
  ) {}

  async list(userId: string, query: NotificationQueryDto) {
    const [items, total] = await this.searches.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return createPaginatedResult(items, total, query.page, query.limit);
  }

  async create(userId: string, dto: CreateSavedSearchDto) {
    const count = await this.searches.countBy({ userId });

    if (count >= 20) {
      throw new ConflictException('Bạn chỉ có thể lưu tối đa 20 bộ lọc');
    }

    return this.searches.save(
      this.searches.create({
        userId,
        name: dto.name.trim(),
        criteria: dto.criteria,
        enabled: true,
      }),
    );
  }

  async update(userId: string, id: string, dto: UpdateSavedSearchDto) {
    const search = await this.searches.findOneBy({ id, userId });

    if (!search) {
      throw new NotFoundException('Không tìm thấy bộ lọc đã lưu');
    }

    if (dto.name !== undefined) {
      search.name = dto.name.trim();
    }

    if (dto.enabled !== undefined) {
      search.enabled = dto.enabled;
    }

    return this.searches.save(search);
  }

  async remove(userId: string, id: string) {
    const result = await this.searches.delete({ id, userId });

    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy bộ lọc đã lưu');
    }

    return { deleted: true };
  }

  @OnEvent(LISTING_EVENTS.ACTIVATED)
  async onListingActivated(event: ListingActivatedPayload): Promise<void> {
    const listing = await this.listings.findOne({
      where: { id: event.listingId, status: ListingStatus.ACTIVE },
      relations: { listingAmenities: true, listingUniversities: true },
    });

    if (!listing) {
      return;
    }

    const searches = await this.searches.findBy({ enabled: true });
    const notifiedUsers = new Set<string>();

    for (const search of searches) {
      if (
        search.userId === listing.ownerId ||
        notifiedUsers.has(search.userId) ||
        !this.matches(listing, search)
      ) {
        continue;
      }

      notifiedUsers.add(search.userId);
      await this.queue.enqueue({
        userId: search.userId,
        eventKey: `listing:${listing.id}:${search.userId}`,
        type: NotificationType.LISTING,
        title: 'Có phòng mới phù hợp',
        body: listing.title,
        payload: { screen: 'ListingDetail', listingId: listing.id },
      });
    }
  }

  private matches(listing: Listing, search: SavedSearch): boolean {
    const criteria = search.criteria;
    const price = Number(listing.price);
    const area = Number(listing.area);

    if (criteria.ownerId && criteria.ownerId !== listing.ownerId) return false;

    if (criteria.minPrice !== undefined && price < criteria.minPrice)
      return false;

    if (criteria.maxPrice !== undefined && price > criteria.maxPrice)
      return false;

    if (criteria.minArea !== undefined && area < criteria.minArea) return false;

    if (criteria.maxArea !== undefined && area > criteria.maxArea) return false;

    if (
      criteria.roomTypes?.length &&
      !criteria.roomTypes.includes(listing.roomType)
    )
      return false;

    if (criteria.keyword) {
      const keyword = this.normalize(criteria.keyword);
      const text = this.normalize(`${listing.title} ${listing.fullAddress}`);

      if (!text.includes(keyword)) return false;
    }

    if (criteria.amenities?.length) {
      const amenities = new Set(
        listing.listingAmenities.map((item) => item.amenityId),
      );

      if (!criteria.amenities.every((id) => amenities.has(id))) return false;
    }

    if (criteria.universityCodes?.length) {
      const universities = new Set(
        listing.listingUniversities.map((item) => item.universityCode),
      );

      if (!criteria.universityCodes.some((code) => universities.has(code)))
        return false;
    }

    if (criteria.latitude !== undefined && criteria.longitude !== undefined) {
      const [longitude, latitude] = listing.location.coordinates;
      const radius = criteria.radius ?? 5;

      if (
        this.distanceKm(
          latitude,
          longitude,
          criteria.latitude,
          criteria.longitude,
        ) > radius
      )
        return false;
    }

    return true;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .trim();
  }

  private distanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const radians = Math.PI / 180;
    const latitudeDistance = (lat2 - lat1) * radians;
    const longitudeDistance = (lon2 - lon1) * radians;
    const value =
      Math.sin(latitudeDistance / 2) ** 2 +
      Math.cos(lat1 * radians) *
        Math.cos(lat2 * radians) *
        Math.sin(longitudeDistance / 2) ** 2;

    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }
}

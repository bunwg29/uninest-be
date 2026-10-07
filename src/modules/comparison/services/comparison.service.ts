import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { ListingsService } from '@modules/listings/services/listings.service';
import {
  COMPARISON_ERROR_MESSAGES,
  COMPARISON_LOCK_PREFIX,
  COMPARISON_STATUS_REASONS,
  COMPARISON_UNAVAILABLE_REASONS,
  MAX_COMPARISON_ITEMS,
} from '../constants';
import { ComparisonItem } from '../entities';

@Injectable()
export class ComparisonService {
  constructor(
    @InjectRepository(ComparisonItem)
    private readonly comparisonRepository: Repository<ComparisonItem>,
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly listingsService: ListingsService,
  ) {}

  async listItems(userId: string) {
    const storedItems = await this.comparisonRepository.find({
      where: { userId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const details = await this.listingsService.getDetailsForComparison(
      userId,
      storedItems.map((item) => item.listingId),
    );
    const detailsById = new Map(details.map((item) => [item.detail.id, item]));

    const items = storedItems.flatMap((storedItem) => {
      const found = detailsById.get(storedItem.listingId);

      if (!found) {
        return [];
      }

      const isActive =
        !found.isDeleted && found.status === ListingStatus.ACTIVE;

      return [
        {
          ...found.detail,
          isAvailable: isActive,
          unavailableReason: isActive
            ? null
            : found.isDeleted
              ? COMPARISON_UNAVAILABLE_REASONS.DELETED
              : (COMPARISON_STATUS_REASONS[found.status] ??
                COMPARISON_UNAVAILABLE_REASONS.DEFAULT),
          addedAt: storedItem.createdAt,
        },
      ];
    });

    return { items, count: items.length, maxItems: MAX_COMPARISON_ITEMS };
  }

  async addItem(userId: string, listingId: string) {
    const listing = await this.listingRepository.findOneBy({ id: listingId });

    if (!listing) {
      throw new NotFoundException(COMPARISON_ERROR_MESSAGES.LISTING_NOT_FOUND);
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new ConflictException(COMPARISON_ERROR_MESSAGES.LISTING_NOT_ACTIVE);
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `${COMPARISON_LOCK_PREFIX}${userId}`,
      ]);

      const repository = manager.getRepository(ComparisonItem);
      const isDuplicate = await repository.existsBy({ userId, listingId });
      const currentCount = await repository.countBy({ userId });

      if (isDuplicate) {
        return {
          listingId,
          added: false,
          count: currentCount,
          maxItems: MAX_COMPARISON_ITEMS,
        };
      }

      if (currentCount >= MAX_COMPARISON_ITEMS) {
        throw new ConflictException(COMPARISON_ERROR_MESSAGES.LIMIT_REACHED);
      }

      await repository.insert({ userId, listingId });

      return {
        listingId,
        added: true,
        count: currentCount + 1,
        maxItems: MAX_COMPARISON_ITEMS,
      };
    });
  }

  async removeItem(userId: string, listingId: string): Promise<void> {
    await this.comparisonRepository.delete({ userId, listingId });
  }

  async clearItems(userId: string): Promise<void> {
    await this.comparisonRepository.delete({ userId });
  }
}

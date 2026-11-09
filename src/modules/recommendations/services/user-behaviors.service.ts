import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LISTING_EVENTS } from '@modules/listings/constants';
import type { ListingInteractionPayload } from '@modules/listings/constants';
import { UserBehaviorEventType } from '../constants';
import { RecordSearchBehaviorDto } from '../dtos';
import {
  SearchBehaviorFilters,
  UserBehavior,
  UserRecommendation,
  UserRecommendationProfile,
} from '../entities';

interface BehaviorSummaryRow {
  viewed: string;
  saved: string;
  searches: string;
}

@Injectable()
export class UserBehaviorsService {
  private readonly logger = new Logger(UserBehaviorsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserBehavior)
    private readonly behaviorRepository: Repository<UserBehavior>,
  ) {}

  @OnEvent(LISTING_EVENTS.VIEWED, { async: true })
  async handleListingViewed(payload: ListingInteractionPayload): Promise<void> {
    await this.safely('view', () =>
      this.behaviorRepository.insert({
        userId: payload.userId,
        listingId: payload.listingId,
        eventType: UserBehaviorEventType.VIEW,
      }),
    );
  }

  @OnEvent(LISTING_EVENTS.FAVORITED, { async: true })
  async handleListingFavorited(
    payload: ListingInteractionPayload,
  ): Promise<void> {
    await this.safely('favorite', () =>
      this.behaviorRepository
        .createQueryBuilder()
        .insert()
        .into(UserBehavior)
        .values({
          userId: payload.userId,
          listingId: payload.listingId,
          eventType: UserBehaviorEventType.FAVORITE,
        })
        .orIgnore()
        .execute(),
    );
  }

  @OnEvent(LISTING_EVENTS.UNFAVORITED, { async: true })
  async handleListingUnfavorited(
    payload: ListingInteractionPayload,
  ): Promise<void> {
    await this.safely('unfavorite', () =>
      this.behaviorRepository.delete({
        userId: payload.userId,
        listingId: payload.listingId,
        eventType: UserBehaviorEventType.FAVORITE,
      }),
    );
  }

  async recordSearch(
    userId: string,
    dto: RecordSearchBehaviorDto,
  ): Promise<{ recorded: boolean }> {
    const keyword = dto.keyword?.trim() || null;
    const filters: SearchBehaviorFilters = {
      minPrice: dto.minPrice,
      maxPrice: dto.maxPrice,
      roomTypes: dto.roomTypes?.length ? dto.roomTypes : undefined,
      amenities: dto.amenities?.length ? dto.amenities : undefined,
      universityCodes: dto.universityCodes?.length
        ? dto.universityCodes
        : undefined,
    };
    const hasFilters = Object.values(filters).some(
      (value) => value !== undefined,
    );

    if (!keyword && !hasFilters) return { recorded: false };

    await this.behaviorRepository.insert({
      userId,
      eventType: UserBehaviorEventType.SEARCH,
      listingId: null,
      keyword,
      filters: hasFilters ? filters : null,
    });

    return { recorded: true };
  }

  async getSummary(userId: string) {
    const row = await this.behaviorRepository
      .createQueryBuilder('behavior')
      .select(
        'COUNT(DISTINCT behavior.listing_id) FILTER (WHERE behavior.event_type = :view)',
        'viewed',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE behavior.event_type = :favorite)',
        'saved',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE behavior.event_type = :search)',
        'searches',
      )
      .where('behavior.user_id = :userId', { userId })
      .setParameters({
        view: UserBehaviorEventType.VIEW,
        favorite: UserBehaviorEventType.FAVORITE,
        search: UserBehaviorEventType.SEARCH,
      })
      .getRawOne<BehaviorSummaryRow>();

    return {
      viewedCount: Number(row?.viewed ?? 0),
      savedCount: Number(row?.saved ?? 0),
      searchCount: Number(row?.searches ?? 0),
    };
  }

  async deleteAll(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserBehavior, { userId });
      await manager.delete(UserRecommendation, { userId });
      await manager.delete(UserRecommendationProfile, { userId });
    });
    this.logger.log(`Behavior history deleted for user ${userId}`);
  }

  private async safely(
    action: string,
    operation: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await operation();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Failed to record ${action} behavior: ${reason}`);
    }
  }
}

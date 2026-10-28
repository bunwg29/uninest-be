import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleType } from '@common/constants';
import { ListingsService } from '@modules/listings/services/listings.service';
import { RECOMMENDATION_DEFAULTS } from '../constants';
import { UserRecommendation, UserRecommendationProfile } from '../entities';
import { RecommendationEngineService } from './recommendation-engine.service';

const REFRESH_INTERVAL_MS =
  RECOMMENDATION_DEFAULTS.REFRESH_INTERVAL_HOURS * 60 * 60 * 1000;

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(UserRecommendationProfile)
    private readonly profileRepository: Repository<UserRecommendationProfile>,
    @InjectRepository(UserRecommendation)
    private readonly recommendationRepository: Repository<UserRecommendation>,
    private readonly recommendationEngineService: RecommendationEngineService,
    private readonly listingsService: ListingsService,
  ) {}

  async getRecommendations(userId: string, limit: number) {
    const profile = await this.ensureFreshProfile(userId);
    const recommendations = await this.recommendationRepository.find({
      where: { userId },
      order: { rank: 'ASC' },
    });
    const scores = new Map(
      recommendations.map((item) => [item.listingId, item.score]),
    );
    const listings = await this.listingsService.getListingsByIds(
      userId,
      UserRoleType.STUDENT,
      recommendations.map((item) => item.listingId),
    );

    return {
      items: listings.slice(0, limit).map((listing) => {
        const score = scores.get(listing.id) ?? 0;

        return {
          ...listing,
          matchPercentage:
            profile.isFallback || score <= 0 ? null : Math.round(score * 100),
        };
      }),
      isFallback: profile.isFallback,
      basedOnListingCount: profile.interactedListingCount,
      computedAt: profile.computedAt,
      nextRefreshAt: new Date(
        profile.computedAt.getTime() + REFRESH_INTERVAL_MS,
      ),
    };
  }

  private async ensureFreshProfile(
    userId: string,
  ): Promise<UserRecommendationProfile> {
    const profile = await this.profileRepository.findOneBy({ userId });

    if (!profile) {
      return this.recommendationEngineService.computeForUser(userId);
    }

    const isStale =
      Date.now() - profile.computedAt.getTime() >= REFRESH_INTERVAL_MS;

    if (isStale) {
      return this.recommendationEngineService.computeForUser(userId);
    }

    if (profile.isFallback) {
      const behaviorCount =
        await this.recommendationEngineService.countRecentBehaviors(userId);

      if (
        behaviorCount !== profile.behaviorCount &&
        behaviorCount >=
          RECOMMENDATION_DEFAULTS.MIN_BEHAVIORS_FOR_PERSONALIZATION
      ) {
        return this.recommendationEngineService.computeForUser(userId);
      }
    }

    return profile;
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingsModule } from '@modules/listings/listings.module';
import {
  RecommendationsController,
  UserBehaviorsController,
} from './controllers';
import {
  UserBehavior,
  UserRecommendation,
  UserRecommendationProfile,
} from './entities';
import {
  RecommendationEngineService,
  RecommendationsService,
  UserBehaviorsService,
} from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserBehavior,
      UserRecommendationProfile,
      UserRecommendation,
    ]),
    ListingsModule,
  ],
  controllers: [RecommendationsController, UserBehaviorsController],
  providers: [
    UserBehaviorsService,
    RecommendationEngineService,
    RecommendationsService,
  ],
  exports: [UserBehaviorsService, RecommendationsService],
})
export class RecommendationsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from '@modules/admin/entities';
import { Booking } from '@modules/booking/entities';
import { ForumModule } from '@modules/forum/forum.module';
import { Listing } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { Review } from './entities';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Booking, Listing, User, Report]),
    ForumModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}

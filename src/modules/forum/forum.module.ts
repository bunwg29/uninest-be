import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsModule } from '@modules/locations/locations.module';
import { AdminForumController } from './controllers/admin-forum.controller';
import { ForumController } from './controllers/forum.controller';
import {
  ForumBannedKeyword,
  ForumComment,
  ForumLike,
  ForumPost,
  ForumPostView,
  ForumReport,
} from './entities';
import { ForumContentModerationInterceptor } from './interceptors/content-moderation';
import { ForumCommentsService } from './services/forum-comments.service';
import { ForumModerationService } from './services/forum-moderation.service';
import { ForumPostsService } from './services/forum-posts.service';
import { ForumPresenterService } from './services/forum-presenter.service';
import { ForumReportsService } from './services/forum-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ForumPost,
      ForumPostView,
      ForumComment,
      ForumLike,
      ForumReport,
      ForumBannedKeyword,
    ]),
    LocationsModule,
  ],
  controllers: [ForumController, AdminForumController],
  providers: [
    ForumModerationService,
    ForumPresenterService,
    ForumPostsService,
    ForumCommentsService,
    ForumReportsService,
    ForumContentModerationInterceptor,
  ],
  exports: [ForumModerationService, ForumPostsService],
})
export class ForumModule {}

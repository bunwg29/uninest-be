import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators';
import { PaginationQueryDto } from '@common/dtos';
import { JwtAuthGuard } from '@common/guards';
import {
  FORUM_CATEGORY_LABELS,
  FORUM_REPORT_REASON_LABELS,
  ROOMMATE_GENDER_LABELS,
  ROOMMATE_STATUS_LABELS,
} from '../constants';
import {
  CheckForumContentDto,
  CreateForumCommentDto,
  CreateForumPostDto,
  CreateForumReportDto,
  ForumPostsQueryDto,
  MyForumPostsQueryDto,
  UpdateForumCommentDto,
  UpdateForumPostDto,
} from '../dtos';
import { ForumContentModerationInterceptor } from '../interceptors/content-moderation';
import { ForumCommentsService } from '../services/forum-comments.service';
import { ForumModerationService } from '../services/forum-moderation.service';
import { ForumPostsService } from '../services/forum-posts.service';
import type { ForumViewer } from '../services/forum-presenter.service';
import { ForumReportsService } from '../services/forum-reports.service';

const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({
    value,
    label,
  }));

@ApiTags('Forum')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('forum')
export class ForumController {
  constructor(
    private readonly postsService: ForumPostsService,
    private readonly commentsService: ForumCommentsService,
    private readonly reportsService: ForumReportsService,
    private readonly moderationService: ForumModerationService,
  ) {}

  @Get('metadata')
  @ApiOperation({
    summary: 'Lấy danh mục chuyên mục, tiêu chí ở ghép và lý do báo cáo',
  })
  getMetadata() {
    return {
      categories: toOptions(FORUM_CATEGORY_LABELS),
      roommateGenders: toOptions(ROOMMATE_GENDER_LABELS),
      roommateStatuses: toOptions(ROOMMATE_STATUS_LABELS),
      reportReasons: toOptions(FORUM_REPORT_REASON_LABELS),
      reportHideThreshold: this.moderationService.getReportHideThreshold(),
    };
  }

  @Post('moderation/check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kiểm tra nội dung trước khi đăng (từ khoá cấm, SĐT, STK)',
  })
  async checkContent(@Body() dto: CheckForumContentDto) {
    return this.moderationService.moderate(
      this.moderationService.extractModeratedContent(dto),
    );
  }

  @Get('posts')
  @ApiOperation({ summary: 'Lấy bảng tin cộng đồng theo chuyên mục, bộ lọc' })
  async getFeed(
    @CurrentUser() viewer: ForumViewer,
    @Query() query: ForumPostsQueryDto,
  ) {
    return this.postsService.getFeed(viewer, query);
  }

  @Get('posts/me')
  @ApiOperation({ summary: 'Lấy bài viết của tôi (gồm nháp, bài bị ẩn)' })
  async getMyPosts(
    @CurrentUser() viewer: ForumViewer,
    @Query() query: MyForumPostsQueryDto,
  ) {
    return this.postsService.getMyPosts(viewer, query);
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Lấy chi tiết bài viết' })
  async getPost(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.postsService.getPostDetail(viewer, id);
  }

  @Post('posts')
  @UseInterceptors(ForumContentModerationInterceptor)
  @ApiOperation({ summary: 'Đăng bài hoặc lưu nháp bài viết' })
  async createPost(
    @CurrentUser() viewer: ForumViewer,
    @Body() dto: CreateForumPostDto,
  ) {
    return this.postsService.createPost(viewer, dto);
  }

  @Patch('posts/:id')
  @UseInterceptors(ForumContentModerationInterceptor)
  @ApiOperation({ summary: 'Sửa bài viết (tác giả hoặc quản trị viên)' })
  async updatePost(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateForumPostDto,
  ) {
    return this.postsService.updatePost(viewer, id, dto);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá mềm bài viết (tác giả hoặc quản trị viên)' })
  async deletePost(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.postsService.deletePost(viewer, id);
  }

  @Post('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thả tim bài viết' })
  async likePost(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.postsService.likePost(viewer, id);
  }

  @Delete('posts/:id/like')
  @ApiOperation({ summary: 'Bỏ thả tim bài viết' })
  async unlikePost(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.postsService.unlikePost(viewer, id);
  }

  @Post('posts/:id/reports')
  @ApiOperation({ summary: 'Báo cáo bài viết vi phạm' })
  async reportPost(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateForumReportDto,
  ) {
    return this.reportsService.reportPost(viewer, id, dto);
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Lấy danh sách bình luận của bài viết' })
  async getComments(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentsService.getComments(viewer, id, query);
  }

  @Post('posts/:id/comments')
  @UseInterceptors(ForumContentModerationInterceptor)
  @ApiOperation({ summary: 'Bình luận hoặc trả lời bình luận' })
  async createComment(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateForumCommentDto,
  ) {
    return this.commentsService.createComment(viewer, id, dto);
  }

  @Patch('comments/:id')
  @UseInterceptors(ForumContentModerationInterceptor)
  @ApiOperation({ summary: 'Sửa bình luận (tác giả hoặc quản trị viên)' })
  async updateComment(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateForumCommentDto,
  ) {
    return this.commentsService.updateComment(viewer, id, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá mềm bình luận (tác giả hoặc quản trị viên)' })
  async deleteComment(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commentsService.deleteComment(viewer, id);
  }

  @Post('comments/:id/reports')
  @ApiOperation({ summary: 'Báo cáo bình luận vi phạm' })
  async reportComment(
    @CurrentUser() viewer: ForumViewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateForumReportDto,
  ) {
    return this.reportsService.reportComment(viewer, id, dto);
  }
}

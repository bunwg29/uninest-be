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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import {
  AdminForumPostsQueryDto,
  AdminForumReportsQueryDto,
  CreateBannedKeywordDto,
  ModerateForumContentDto,
  UpdateBannedKeywordDto,
} from '../dtos';
import { ForumModerationService } from '../services/forum-moderation.service';
import type { ForumViewer } from '../services/forum-presenter.service';
import { ForumReportsService } from '../services/forum-reports.service';

@ApiTags('Admin Forum')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.ADMIN)
@Controller('admin/forum')
export class AdminForumController {
  constructor(
    private readonly reportsService: ForumReportsService,
    private readonly moderationService: ForumModerationService,
  ) {}

  @Get('posts')
  @ApiOperation({
    summary: 'Lấy bài viết cần kiểm duyệt (mặc định: đã ẩn – chờ xử lý)',
  })
  async getModerationPosts(
    @CurrentUser() viewer: ForumViewer,
    @Query() query: AdminForumPostsQueryDto,
  ) {
    return this.reportsService.getModerationPosts(viewer, query);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Lấy danh sách báo cáo bài viết, bình luận' })
  async getReports(@Query() query: AdminForumReportsQueryDto) {
    return this.reportsService.getReports(query);
  }

  @Patch('posts/:id/moderation')
  @ApiOperation({ summary: 'Hiển thị lại hoặc gỡ bài viết bị báo cáo' })
  async moderatePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateForumContentDto,
  ) {
    return this.reportsService.moderatePost(id, dto.decision);
  }

  @Patch('comments/:id/moderation')
  @ApiOperation({ summary: 'Hiển thị lại hoặc gỡ bình luận bị báo cáo' })
  async moderateComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateForumContentDto,
  ) {
    return this.reportsService.moderateComment(id, dto.decision);
  }

  @Get('banned-keywords')
  @ApiOperation({ summary: 'Lấy danh sách từ khoá cấm' })
  async getBannedKeywords() {
    return this.moderationService.listKeywords();
  }

  @Post('banned-keywords')
  @ApiOperation({ summary: 'Thêm từ khoá cấm' })
  async createBannedKeyword(@Body() dto: CreateBannedKeywordDto) {
    return this.moderationService.createKeyword(dto);
  }

  @Patch('banned-keywords/:id')
  @ApiOperation({ summary: 'Cập nhật từ khoá cấm' })
  async updateBannedKeyword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannedKeywordDto,
  ) {
    return this.moderationService.updateKeyword(id, dto);
  }

  @Delete('banned-keywords/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá từ khoá cấm' })
  async deleteBannedKeyword(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.moderationService.deleteKeyword(id);
  }
}

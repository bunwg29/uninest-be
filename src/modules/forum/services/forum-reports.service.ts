import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { createPaginatedResult } from '@common/dtos';
import { FORUM_REPORT_REASON_LABELS } from '../constants';
import {
  AdminForumPostsQueryDto,
  AdminForumReportsQueryDto,
  AdminModerationDecision,
  CreateForumReportDto,
} from '../dtos';
import {
  ForumComment,
  ForumCommentStatus,
  ForumPost,
  ForumPostStatus,
  ForumReport,
  ForumReportReason,
  ForumReportTargetType,
} from '../entities';
import { ForumModerationService } from './forum-moderation.service';
import { ForumPresenterService, ForumViewer } from './forum-presenter.service';

type ReportTarget = {
  type: ForumReportTargetType;
  id: string;
  authorId: string;
};

@Injectable()
export class ForumReportsService {
  constructor(
    @InjectRepository(ForumPost)
    private readonly postRepository: Repository<ForumPost>,
    @InjectRepository(ForumComment)
    private readonly commentRepository: Repository<ForumComment>,
    @InjectRepository(ForumReport)
    private readonly reportRepository: Repository<ForumReport>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly moderationService: ForumModerationService,
    private readonly presenter: ForumPresenterService,
  ) {}

  async reportPost(
    viewer: ForumViewer,
    postId: string,
    dto: CreateForumReportDto,
  ) {
    const post = await this.postRepository.findOneBy({
      id: postId,
      status: ForumPostStatus.PUBLISHED,
    });

    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    return this.submitReport(
      viewer,
      {
        type: ForumReportTargetType.POST,
        id: post.id,
        authorId: post.authorId,
      },
      dto,
    );
  }

  async reportComment(
    viewer: ForumViewer,
    commentId: string,
    dto: CreateForumReportDto,
  ) {
    const comment = await this.commentRepository.findOneBy({
      id: commentId,
      status: ForumCommentStatus.PUBLISHED,
    });

    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    return this.submitReport(
      viewer,
      {
        type: ForumReportTargetType.COMMENT,
        id: comment.id,
        authorId: comment.authorId,
      },
      dto,
    );
  }

  async getModerationPosts(
    viewer: ForumViewer,
    query: AdminForumPostsQueryDto,
  ) {
    const { page, limit } = query;
    const [posts, total] = await this.postRepository.findAndCount({
      where: {
        status: query.status,
        ...(query.category ? { category: query.category } : {}),
      },
      relations: { author: true },
      order: { reportCount: 'DESC', updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const reasonSummaries = await this.getReasonSummaries(
      ForumReportTargetType.POST,
      posts.map((post) => post.id),
    );
    const items = posts.map((post) => ({
      ...this.presenter.toPost(post, viewer, false),
      reportCount: post.reportCount,
      moderationFlags: post.moderationFlags,
      hiddenAt: post.hiddenAt,
      reportReasons: reasonSummaries.get(post.id) ?? [],
    }));

    return createPaginatedResult(items, total, page, limit);
  }

  async getReports(query: AdminForumReportsQueryDto) {
    const { page, limit } = query;
    const [reports, total] = await this.reportRepository.findAndCount({
      where: {
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.isResolved !== undefined
          ? { isResolved: query.isResolved }
          : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const items = reports.map((report) => ({
      ...report,
      reasonLabel: FORUM_REPORT_REASON_LABELS[report.reason],
    }));

    return createPaginatedResult(items, total, page, limit);
  }

  async moderatePost(postId: string, decision: AdminModerationDecision) {
    const post = await this.postRepository.findOneBy({ id: postId });

    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    if (post.status === ForumPostStatus.DRAFT) {
      throw new BadRequestException('Không thể xử lý bài viết đang là nháp');
    }

    await this.dataSource.transaction(async (manager) => {
      await this.resolveReports(manager, ForumReportTargetType.POST, post.id);

      if (decision === 'remove') {
        await manager.softDelete(ForumPost, { id: post.id });

        return;
      }

      await manager.update(
        ForumPost,
        { id: post.id },
        { status: ForumPostStatus.PUBLISHED, reportCount: 0, hiddenAt: null },
      );
    });

    return {
      id: post.id,
      decision,
      status: decision === 'remove' ? 'removed' : ForumPostStatus.PUBLISHED,
    };
  }

  async moderateComment(commentId: string, decision: AdminModerationDecision) {
    const comment = await this.commentRepository.findOneBy({ id: commentId });

    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    const wasPublished = comment.status === ForumCommentStatus.PUBLISHED;

    await this.dataSource.transaction(async (manager) => {
      await this.resolveReports(
        manager,
        ForumReportTargetType.COMMENT,
        comment.id,
      );

      if (decision === 'remove') {
        await manager.softDelete(ForumComment, { id: comment.id });

        if (wasPublished) {
          await this.adjustCommentCount(manager, comment.postId, -1);
        }

        return;
      }

      await manager.update(
        ForumComment,
        { id: comment.id },
        {
          status: ForumCommentStatus.PUBLISHED,
          reportCount: 0,
          hiddenAt: null,
        },
      );

      if (!wasPublished) {
        await this.adjustCommentCount(manager, comment.postId, 1);
      }
    });

    return {
      id: comment.id,
      decision,
      status: decision === 'remove' ? 'removed' : ForumCommentStatus.PUBLISHED,
    };
  }

  private async submitReport(
    viewer: ForumViewer,
    target: ReportTarget,
    dto: CreateForumReportDto,
  ) {
    if (target.authorId === viewer.userId) {
      throw new BadRequestException(
        'Bạn không thể báo cáo nội dung của chính mình',
      );
    }

    const threshold = this.moderationService.getReportHideThreshold();

    return this.dataSource.transaction(async (manager) => {
      const insertResult = await manager
        .createQueryBuilder()
        .insert()
        .into(ForumReport)
        .values({
          reporterId: viewer.userId,
          targetType: target.type,
          targetId: target.id,
          reason: dto.reason,
          note: dto.note ?? null,
        })
        .orIgnore()
        .returning(['id'])
        .execute();
      const isNewReport =
        Array.isArray(insertResult.raw) && insertResult.raw.length > 0;

      if (!isNewReport) {
        throw new ConflictException('Bạn đã báo cáo nội dung này trước đó');
      }

      const reportCount = await manager.count(ForumReport, {
        where: {
          targetType: target.type,
          targetId: target.id,
          isResolved: false,
        },
      });
      const isAutoHidden =
        reportCount >= threshold &&
        (await this.hideTarget(manager, target, reportCount));

      if (!isAutoHidden) {
        await manager.update(
          target.type === ForumReportTargetType.POST ? ForumPost : ForumComment,
          { id: target.id },
          { reportCount },
        );
      }

      return {
        targetType: target.type,
        targetId: target.id,
        reason: dto.reason,
        reasonLabel: FORUM_REPORT_REASON_LABELS[dto.reason],
        isHidden: isAutoHidden,
      };
    });
  }

  private async hideTarget(
    manager: EntityManager,
    target: ReportTarget,
    reportCount: number,
  ): Promise<boolean> {
    if (target.type === ForumReportTargetType.POST) {
      const result = await manager.update(
        ForumPost,
        { id: target.id, status: ForumPostStatus.PUBLISHED },
        { status: ForumPostStatus.HIDDEN, reportCount, hiddenAt: new Date() },
      );

      return Boolean(result.affected);
    }

    const result = await manager.update(
      ForumComment,
      { id: target.id, status: ForumCommentStatus.PUBLISHED },
      { status: ForumCommentStatus.HIDDEN, reportCount, hiddenAt: new Date() },
    );

    if (!result.affected) {
      return false;
    }

    const comment = await manager.findOneByOrFail(ForumComment, {
      id: target.id,
    });

    await this.adjustCommentCount(manager, comment.postId, -1);

    return true;
  }

  private async resolveReports(
    manager: EntityManager,
    targetType: ForumReportTargetType,
    targetId: string,
  ): Promise<void> {
    await manager.update(
      ForumReport,
      { targetType, targetId, isResolved: false },
      { isResolved: true },
    );
  }

  private async adjustCommentCount(
    manager: EntityManager,
    postId: string,
    delta: number,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(ForumPost)
      .set({ commentCount: () => 'GREATEST(comment_count + :delta, 0)' })
      .where('id = :postId', { postId })
      .setParameter('delta', delta)
      .execute();
  }

  private async getReasonSummaries(
    targetType: ForumReportTargetType,
    targetIds: string[],
  ) {
    const summaries = new Map<
      string,
      { reason: ForumReportReason; label: string; count: number }[]
    >();

    if (!targetIds.length) {
      return summaries;
    }

    const rows = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.targetId', 'targetId')
      .addSelect('report.reason', 'reason')
      .addSelect('COUNT(report.id)', 'count')
      .where('report.targetType = :targetType', { targetType })
      .andWhere({ targetId: In(targetIds), isResolved: false })
      .groupBy('report.targetId')
      .addGroupBy('report.reason')
      .getRawMany<{
        targetId: string;
        reason: ForumReportReason;
        count: string;
      }>();

    for (const row of rows) {
      const targetSummaries = summaries.get(row.targetId) ?? [];

      targetSummaries.push({
        reason: row.reason,
        label: FORUM_REPORT_REASON_LABELS[row.reason],
        count: Number(row.count),
      });
      summaries.set(row.targetId, targetSummaries);
    }

    return summaries;
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In, Repository } from 'typeorm';
import { createPaginatedResult } from '@common/dtos';
import { UserRoleType } from '@common/constants';
import { RefreshToken } from '@modules/auth/entities/refresh-token';
import {
  ForumComment,
  ForumCommentStatus,
  ForumPost,
  ForumPostStatus,
  ForumReport,
  ForumReportTargetType,
} from '@modules/forum/entities';
import { LISTING_EVENTS } from '@modules/listings/constants';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { ForumModerationService } from '@modules/forum/services/forum-moderation.service';
import { ADMIN_EVENTS } from '../constants';
import {
  AdminReportsQueryDto,
  ReportResolutionAction,
  ReportUserDto,
} from '../dtos';
import { Report, ReportEntityType, ReportStatus } from '../entities';
import { AdminAuditService } from './admin-audit.service';

interface ReportTarget {
  label: string;
  hidden: boolean;
  ownerName: string | null;
}

export interface ReportContent {
  title: string | null;
  body: string | null;
  ownerId: string;
  ownerName: string;
  createdAt: Date;
  viewCount: number | null;
  commentCount: number | null;
  category: string | null;
  status: string;
  price: string | null;
  address: string | null;
}

@Injectable()
export class AdminReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly repository: Repository<Report>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AdminAuditService,
    private readonly moderationService: ForumModerationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(query: AdminReportsQueryDto) {
    const builder = this.repository.createQueryBuilder('report');

    if (query.entityType) {
      builder.andWhere('report.entityType = :entityType', {
        entityType: query.entityType,
      });
    }

    if (query.status) {
      builder.andWhere('report.status = :status', { status: query.status });
    }

    const totalRow = await builder
      .clone()
      .select('COUNT(DISTINCT (report.entityType, report.entityId))', 'total')
      .getRawOne<{ total: string }>();
    const rows = await builder
      .select('MAX(report.id::text)', 'id')
      .addSelect('report.entityType', 'entityType')
      .addSelect('report.entityId', 'entityId')
      .addSelect('COUNT(report.id)', 'reportCount')
      .addSelect('MAX(report.createdAt)', 'latestAt')
      .addSelect('MODE() WITHIN GROUP (ORDER BY report.reason)', 'mainReason')
      .addSelect(
        `CASE WHEN BOOL_OR(report.status = :pendingStatus) THEN :pendingStatus WHEN BOOL_OR(report.status = :resolvedStatus) THEN :resolvedStatus ELSE :dismissedStatus END`,
        'status',
      )
      .setParameters({
        pendingStatus: ReportStatus.PENDING,
        resolvedStatus: ReportStatus.RESOLVED,
        dismissedStatus: ReportStatus.DISMISSED,
      })
      .groupBy('report.entityType')
      .addGroupBy('report.entityId')
      .orderBy('MAX(report.createdAt)', 'DESC')
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getRawMany<{
        id: string;
        entityType: ReportEntityType;
        entityId: string;
        reportCount: string;
        latestAt: Date;
        mainReason: string;
        status: ReportStatus;
      }>();
    const [targets, counts] = await Promise.all([
      this.getTargets(rows),
      this.countByEntityType(query.status),
    ]);
    const items = rows.map((row) => {
      const target = targets.get(row.entityId);

      return {
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        targetLabel: target?.label ?? 'Nội dung không còn tồn tại',
        targetHidden: target?.hidden ?? false,
        ownerName: target?.ownerName ?? null,
        mainReason: row.mainReason,
        status: row.status,
        reportCount: Number(row.reportCount),
        latestAt: row.latestAt,
      };
    });

    return {
      ...createPaginatedResult(
        items,
        Number(totalRow?.total ?? 0),
        query.page,
        query.limit,
      ),
      counts,
    };
  }

  async getDetail(id: string) {
    const report = await this.repository.findOneBy({ id });

    if (!report) {
      throw new NotFoundException('Không tìm thấy báo cáo');
    }

    const reports = await this.repository.find({
      where: { entityType: report.entityType, entityId: report.entityId },
      order: { createdAt: 'DESC' },
    });
    const reasonCounts = reports.reduce<Record<string, number>>(
      (counts, item) => {
        counts[item.reason] = (counts[item.reason] ?? 0) + 1;

        return counts;
      },
      {},
    );
    const pendingCount = reports.filter(
      (item) => item.status === ReportStatus.PENDING,
    ).length;
    const [targets, content, comments] = await Promise.all([
      this.getTargets([report]),
      this.getContent(report),
      this.getRelatedComments(report),
    ]);
    const target = targets.get(report.entityId);
    const ownerReportCount = content?.ownerId
      ? await this.countOwnerReportedTargets(content.ownerId, report.entityId)
      : 0;

    return {
      id: report.id,
      entityType: report.entityType,
      entityId: report.entityId,
      targetLabel: target?.label ?? 'Nội dung không còn tồn tại',
      targetHidden: target?.hidden ?? false,
      status: pendingCount > 0 ? ReportStatus.PENDING : report.status,
      reportCount: reports.length,
      pendingCount,
      hideThreshold: this.moderationService.getReportHideThreshold(),
      firstAt: reports[reports.length - 1]?.createdAt ?? report.createdAt,
      latestAt: reports[0]?.createdAt ?? report.createdAt,
      reasonCounts,
      ownerReportCount,
      content,
      comments,
      reports: reports.map((item) => ({
        id: item.id,
        reason: item.reason,
        note: item.note,
        createdAt: item.createdAt,
        status: item.status,
      })),
    };
  }

  async reportUser(reporterId: string, userId: string, dto: ReportUserDto) {
    if (reporterId === userId) {
      throw new BadRequestException('Bạn không thể báo cáo chính mình');
    }

    if (!(await this.dataSource.getRepository(User).existsBy({ id: userId }))) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        reporterId,
        entityType: ReportEntityType.USER,
        entityId: userId,
        reason: dto.reason.trim(),
        note: dto.note?.trim() || null,
      })
      .orIgnore()
      .returning(['id'])
      .execute();

    if (!Array.isArray(result.raw) || result.raw.length === 0) {
      throw new ConflictException('Bạn đã báo cáo tài khoản này trước đó');
    }

    return { userId, reported: true };
  }

  async resolve(
    actorId: string,
    reportId: string,
    action: ReportResolutionAction,
    reason: string,
  ) {
    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      throw new BadRequestException('Vui lòng nhập lý do xử lý');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const report = await manager.findOneBy(Report, { id: reportId });

      if (!report) {
        throw new NotFoundException('Không tìm thấy báo cáo');
      }

      const pendingReports = await manager.find(Report, {
        where: {
          entityType: report.entityType,
          entityId: report.entityId,
          status: ReportStatus.PENDING,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (pendingReports.length === 0) {
        throw new ConflictException('Báo cáo đã được xử lý');
      }

      if (action === ReportResolutionAction.LOCK_USER) {
        const ownerId = await this.getTargetOwnerId(manager, report);

        if (!ownerId) {
          throw new NotFoundException('Không tìm thấy chủ nội dung');
        }

        const owner = await manager.findOneBy(User, { id: ownerId });

        if (
          !owner ||
          owner.roleId === UserRoleType.ADMIN ||
          ownerId === actorId
        ) {
          throw new BadRequestException(
            'Không thể khoá tài khoản quản trị viên',
          );
        }

        if (!owner.isActive) {
          throw new ConflictException('Tài khoản đã bị khoá');
        }

        await manager.update(User, { id: ownerId }, { isActive: false });
        await manager.update(
          RefreshToken,
          { userId: ownerId, isRevoked: false },
          { isRevoked: true },
        );
        await manager.update(
          Listing,
          { ownerId, status: ListingStatus.ACTIVE },
          { status: ListingStatus.HIDDEN },
        );
        await this.auditService.record(
          manager,
          actorId,
          'user.lock',
          'user',
          ownerId,
          normalizedReason,
        );
      } else if (action === ReportResolutionAction.REMOVE) {
        await this.removeTarget(manager, report, normalizedReason);
      } else if (
        action === ReportResolutionAction.DISMISS ||
        action === ReportResolutionAction.WARN
      ) {
        await this.restoreForumTarget(manager, report);
      }

      const status =
        action === ReportResolutionAction.DISMISS
          ? ReportStatus.DISMISSED
          : ReportStatus.RESOLVED;

      await manager.update(
        Report,
        {
          entityType: report.entityType,
          entityId: report.entityId,
          status: ReportStatus.PENDING,
        },
        {
          status,
          resolvedBy: actorId,
          resolutionReason: normalizedReason,
          resolvedAt: new Date(),
        },
      );

      if (
        report.entityType === ReportEntityType.FORUM_POST ||
        report.entityType === ReportEntityType.FORUM_COMMENT
      ) {
        await manager.update(
          ForumReport,
          {
            targetType:
              report.entityType === ReportEntityType.FORUM_POST
                ? ForumReportTargetType.POST
                : ForumReportTargetType.COMMENT,
            targetId: report.entityId,
            isResolved: false,
          },
          { isResolved: true },
        );
      }

      const warningRecipientId =
        action === ReportResolutionAction.WARN
          ? await this.getTargetOwnerId(manager, report)
          : null;

      if (action === ReportResolutionAction.WARN && !warningRecipientId) {
        throw new NotFoundException('Không tìm thấy chủ nội dung');
      }

      const warningPostId =
        action === ReportResolutionAction.WARN &&
        report.entityType === ReportEntityType.FORUM_COMMENT
          ? (await manager.findOneBy(ForumComment, { id: report.entityId }))
              ?.postId
          : null;

      const audit = await this.auditService.record(
        manager,
        actorId,
        `report.${action}`,
        report.entityType,
        report.entityId,
        normalizedReason,
      );

      const hiddenListingOwnerId =
        action === ReportResolutionAction.REMOVE &&
        report.entityType === ReportEntityType.LISTING
          ? await this.getTargetOwnerId(manager, report)
          : null;

      return {
        id: report.id,
        status,
        action,
        hiddenListingOwnerId,
        warningRecipientId,
        warningPostId,
        auditId: audit.id,
        entityType: report.entityType,
        entityId: report.entityId,
      };
    });

    if (result.warningRecipientId) {
      this.eventEmitter.emit(ADMIN_EVENTS.REPORT_WARNING_ISSUED, {
        auditId: result.auditId,
        userId: result.warningRecipientId,
        entityType: result.entityType,
        entityId: result.entityId,
        postId: result.warningPostId ?? undefined,
        reason: normalizedReason,
      });
    }

    if (result.hiddenListingOwnerId) {
      this.eventEmitter.emit(LISTING_EVENTS.AVAILABILITY_CHANGED, {
        listingId: result.entityId,
      });
      this.eventEmitter.emit(LISTING_EVENTS.REVIEWED, {
        listingId: result.entityId,
        ownerId: result.hiddenListingOwnerId,
        status: ListingStatus.HIDDEN,
        reason: normalizedReason,
        auditId: result.auditId,
      });
    }

    return { id: result.id, status: result.status, action: result.action };
  }

  private async getTargets(
    rows: Pick<Report, 'entityType' | 'entityId'>[],
  ): Promise<Map<string, ReportTarget>> {
    const targets = new Map<string, ReportTarget>();
    const ids = (type: ReportEntityType) =>
      rows.filter((row) => row.entityType === type).map((row) => row.entityId);
    const [listings, posts, comments, users] = await Promise.all([
      this.dataSource.getRepository(Listing).find({
        where: { id: In(ids(ReportEntityType.LISTING)) },
        relations: { owner: true },
      }),
      this.dataSource.getRepository(ForumPost).find({
        where: { id: In(ids(ReportEntityType.FORUM_POST)) },
        relations: { author: true },
      }),
      this.dataSource.getRepository(ForumComment).find({
        where: { id: In(ids(ReportEntityType.FORUM_COMMENT)) },
        relations: { author: true },
      }),
      this.dataSource
        .getRepository(User)
        .findBy({ id: In(ids(ReportEntityType.USER)) }),
    ]);

    listings.forEach((item) =>
      targets.set(item.id, {
        label: item.title,
        hidden: item.status === ListingStatus.HIDDEN,
        ownerName: item.owner?.fullName ?? null,
      }),
    );
    posts.forEach((item) =>
      targets.set(item.id, {
        label: item.title,
        hidden: item.status === ForumPostStatus.HIDDEN,
        ownerName: item.author?.fullName ?? null,
      }),
    );
    comments.forEach((item) =>
      targets.set(item.id, {
        label: item.content.slice(0, 80),
        hidden: item.status === ForumCommentStatus.HIDDEN,
        ownerName: item.author?.fullName ?? null,
      }),
    );
    users.forEach((item) =>
      targets.set(item.id, {
        label: item.fullName,
        hidden: !item.isActive,
        ownerName: item.fullName,
      }),
    );

    return targets;
  }

  private async countByEntityType(status?: ReportStatus) {
    const builder = this.repository
      .createQueryBuilder('report')
      .select('report.entityType', 'entityType')
      .addSelect('COUNT(DISTINCT report.entityId)', 'count')
      .groupBy('report.entityType');

    if (status) builder.where('report.status = :status', { status });

    const rows = await builder.getRawMany<{
      entityType: ReportEntityType;
      count: string;
    }>();
    const counts = Object.fromEntries(
      Object.values(ReportEntityType).map((type) => [type, 0]),
    ) as Record<ReportEntityType, number>;

    rows.forEach((row) => {
      counts[row.entityType] = Number(row.count);
    });

    return {
      all: Object.values(counts).reduce((sum, value) => sum + value, 0),
      ...counts,
    };
  }

  private async getContent(report: Report): Promise<ReportContent | null> {
    if (report.entityType === ReportEntityType.LISTING) {
      const listing = await this.dataSource.getRepository(Listing).findOne({
        where: { id: report.entityId },
        relations: { owner: true },
      });

      return listing
        ? {
            title: listing.title,
            body: listing.description,
            ownerId: listing.ownerId,
            ownerName: listing.owner.fullName,
            createdAt: listing.createdAt,
            viewCount: listing.viewCount,
            commentCount: null,
            category: null,
            status: listing.status,
            price: listing.price,
            address: listing.fullAddress,
          }
        : null;
    }

    if (report.entityType === ReportEntityType.FORUM_POST) {
      const post = await this.dataSource.getRepository(ForumPost).findOne({
        where: { id: report.entityId },
        relations: { author: true },
      });

      return post
        ? {
            title: post.title,
            body: post.content,
            ownerId: post.authorId,
            ownerName: post.author.fullName,
            createdAt: post.publishedAt ?? post.createdAt,
            viewCount: post.viewCount,
            commentCount: post.commentCount,
            category: post.category,
            status: post.status,
            price: null,
            address: null,
          }
        : null;
    }

    if (report.entityType === ReportEntityType.FORUM_COMMENT) {
      const comment = await this.dataSource
        .getRepository(ForumComment)
        .findOne({
          where: { id: report.entityId },
          relations: { author: true, post: true },
        });

      return comment
        ? {
            title: comment.post?.title ?? null,
            body: comment.content,
            ownerId: comment.authorId,
            ownerName: comment.author.fullName,
            createdAt: comment.createdAt,
            viewCount: null,
            commentCount: null,
            category: comment.post?.category ?? null,
            status: comment.status,
            price: null,
            address: null,
          }
        : null;
    }

    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: report.entityId });

    return user
      ? {
          title: user.fullName,
          body: null,
          ownerId: user.id,
          ownerName: user.fullName,
          createdAt: user.createdAt,
          viewCount: null,
          commentCount: null,
          category: null,
          status: user.isActive ? 'active' : 'locked',
          price: null,
          address: null,
        }
      : null;
  }

  private async getRelatedComments(report: Report) {
    if (report.entityType !== ReportEntityType.FORUM_POST) return [];

    const comments = await this.dataSource.getRepository(ForumComment).find({
      where: {
        postId: report.entityId,
        status: ForumCommentStatus.PUBLISHED,
      },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return comments.map((comment) => ({
      id: comment.id,
      authorName: comment.author.fullName,
      content: comment.content,
      createdAt: comment.createdAt,
    }));
  }

  private async countOwnerReportedTargets(ownerId: string, excludeId: string) {
    const [row] = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(DISTINCT (report.entity_type, report.entity_id)) AS count
      FROM reports report
      LEFT JOIN listings listing ON report.entity_type = 'listing' AND listing.id = report.entity_id
      LEFT JOIN forum_posts post ON report.entity_type = 'forum_post' AND post.id = report.entity_id
      LEFT JOIN forum_comments comment ON report.entity_type = 'forum_comment' AND comment.id = report.entity_id
      WHERE report.entity_id <> $2
        AND (listing.owner_id = $1 OR post.author_id = $1 OR comment.author_id = $1 OR (report.entity_type = 'user' AND report.entity_id = $1))`,
      [ownerId, excludeId],
    );

    return Number(row?.count ?? 0);
  }

  private async getTargetOwnerId(
    manager: DataSource['manager'],
    report: Report,
  ): Promise<string | null> {
    if (report.entityType === ReportEntityType.USER) {
      return report.entityId;
    }

    if (report.entityType === ReportEntityType.LISTING) {
      const listing = await manager.findOneBy(Listing, { id: report.entityId });

      return listing?.ownerId ?? null;
    }

    if (report.entityType === ReportEntityType.FORUM_POST) {
      const post = await manager.findOneBy(ForumPost, { id: report.entityId });

      return post?.authorId ?? null;
    }

    const comment = await manager.findOneBy(ForumComment, {
      id: report.entityId,
    });

    return comment?.authorId ?? null;
  }

  private async removeTarget(
    manager: DataSource['manager'],
    report: Report,
    reason: string,
  ) {
    if (report.entityType === ReportEntityType.LISTING) {
      await manager.update(
        Listing,
        { id: report.entityId },
        {
          status: ListingStatus.HIDDEN,
          moderationHiddenAt: new Date(),
          moderationReason: reason,
        },
      );
    } else if (report.entityType === ReportEntityType.FORUM_POST) {
      await manager.softDelete(ForumPost, { id: report.entityId });
    } else if (report.entityType === ReportEntityType.FORUM_COMMENT) {
      const comment = await manager.findOneBy(ForumComment, {
        id: report.entityId,
      });

      if (!comment) {
        throw new NotFoundException('Không tìm thấy bình luận');
      }

      await manager.softDelete(ForumComment, { id: report.entityId });

      if (comment.status === ForumCommentStatus.PUBLISHED) {
        await this.adjustCommentCount(manager, comment.postId, -1);
      }
    } else {
      throw new BadRequestException('Dùng thao tác khoá để xử lý tài khoản');
    }
  }

  private async restoreForumTarget(
    manager: DataSource['manager'],
    report: Report,
  ) {
    if (report.entityType === ReportEntityType.FORUM_POST) {
      await manager.update(
        ForumPost,
        { id: report.entityId, status: ForumPostStatus.HIDDEN },
        { status: ForumPostStatus.PUBLISHED, reportCount: 0, hiddenAt: null },
      );
    } else if (report.entityType === ReportEntityType.FORUM_COMMENT) {
      const comment = await manager.findOneBy(ForumComment, {
        id: report.entityId,
      });
      const restored = await manager.update(
        ForumComment,
        { id: report.entityId, status: ForumCommentStatus.HIDDEN },
        {
          status: ForumCommentStatus.PUBLISHED,
          reportCount: 0,
          hiddenAt: null,
        },
      );

      if (restored.affected && comment) {
        await this.adjustCommentCount(manager, comment.postId, 1);
      }
    }
  }

  private async adjustCommentCount(
    manager: DataSource['manager'],
    postId: string,
    delta: number,
  ) {
    await manager
      .createQueryBuilder()
      .update(ForumPost)
      .set({ commentCount: () => 'GREATEST(comment_count + :delta, 0)' })
      .where('id = :postId', { postId })
      .setParameter('delta', delta)
      .execute();
  }
}

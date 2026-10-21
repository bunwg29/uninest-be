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
import { Listing, ListingStatus } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { ADMIN_EVENTS } from '../constants';
import {
  AdminReportsQueryDto,
  ReportResolutionAction,
  ReportUserDto,
} from '../dtos';
import { Report, ReportEntityType, ReportStatus } from '../entities';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly repository: Repository<Report>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AdminAuditService,
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
      }>();
    const labels = await this.getTargetLabels(rows);
    const items = rows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      targetLabel: labels.get(row.entityId) ?? 'Nội dung không còn tồn tại',
      reportCount: Number(row.reportCount),
      latestAt: row.latestAt,
    }));

    return createPaginatedResult(
      items,
      Number(totalRow?.total ?? 0),
      query.page,
      query.limit,
    );
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
    const labels = await this.getTargetLabels([report]);

    return {
      id: report.id,
      entityType: report.entityType,
      entityId: report.entityId,
      targetLabel: labels.get(report.entityId) ?? 'Nội dung không còn tồn tại',
      status: report.status,
      reportCount: reports.length,
      reasonCounts,
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
      const report = await manager.findOne(Report, {
        where: { id: reportId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!report) {
        throw new NotFoundException('Không tìm thấy báo cáo');
      }

      if (report.status !== ReportStatus.PENDING) {
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
        await this.removeTarget(manager, report);
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

      const audit = await this.auditService.record(
        manager,
        actorId,
        `report.${action}`,
        report.entityType,
        report.entityId,
        normalizedReason,
      );

      return {
        id: report.id,
        status,
        action,
        warningRecipientId,
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
        reason: normalizedReason,
      });
    }

    return { id: result.id, status: result.status, action: result.action };
  }

  private async getTargetLabels(
    rows: Pick<Report, 'entityType' | 'entityId'>[],
  ): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    const ids = (type: ReportEntityType) =>
      rows.filter((row) => row.entityType === type).map((row) => row.entityId);
    const [listings, posts, comments, users] = await Promise.all([
      this.dataSource
        .getRepository(Listing)
        .findBy({ id: In(ids(ReportEntityType.LISTING)) }),
      this.dataSource
        .getRepository(ForumPost)
        .findBy({ id: In(ids(ReportEntityType.FORUM_POST)) }),
      this.dataSource
        .getRepository(ForumComment)
        .findBy({ id: In(ids(ReportEntityType.FORUM_COMMENT)) }),
      this.dataSource
        .getRepository(User)
        .findBy({ id: In(ids(ReportEntityType.USER)) }),
    ]);

    listings.forEach((item) => labels.set(item.id, item.title));
    posts.forEach((item) => labels.set(item.id, item.title));
    comments.forEach((item) => labels.set(item.id, item.content.slice(0, 80)));
    users.forEach((item) => labels.set(item.id, item.fullName));

    return labels;
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

  private async removeTarget(manager: DataSource['manager'], report: Report) {
    if (report.entityType === ReportEntityType.LISTING) {
      await manager.update(
        Listing,
        { id: report.entityId },
        { status: ListingStatus.HIDDEN },
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

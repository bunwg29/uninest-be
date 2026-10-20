import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { createPaginatedResult, PaginationQueryDto } from '@common/dtos';
import { CreateForumCommentDto, UpdateForumCommentDto } from '../dtos';
import { ForumComment, ForumCommentStatus, ForumPost } from '../entities';
import { ForumModerationService } from './forum-moderation.service';
import { ForumPostsService } from './forum-posts.service';
import { ForumPresenterService, ForumViewer } from './forum-presenter.service';

const FORUM_REPLY_PREVIEW_LIMIT = 2;

@Injectable()
export class ForumCommentsService {
  constructor(
    @InjectRepository(ForumComment)
    private readonly commentRepository: Repository<ForumComment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly postsService: ForumPostsService,
    private readonly moderationService: ForumModerationService,
    private readonly presenter: ForumPresenterService,
  ) {}

  async getComments(
    viewer: ForumViewer,
    postId: string,
    query: PaginationQueryDto,
  ) {
    const { page, limit } = query;

    await this.postsService.findVisiblePost(viewer, postId);

    const [roots, total] = await this.createVisibleCommentsQuery(viewer)
      .andWhere('comment.postId = :postId', { postId })
      .andWhere('comment.parentId IS NULL')
      .orderBy('comment.createdAt', 'ASC')
      .addOrderBy('comment.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const rootIds = roots.map((root) => root.id);
    const [replyCounts, previews] = await Promise.all([
      this.countReplies(viewer, rootIds),
      this.loadReplyPreviews(viewer, rootIds),
    ]);

    return createPaginatedResult(
      roots.map((root) => ({
        ...this.presenter.toComment(root, viewer),
        replyCount: replyCounts.get(root.id) ?? 0,
        replies: (previews.get(root.id) ?? []).map((reply) =>
          this.presenter.toComment(reply, viewer),
        ),
      })),
      total,
      page,
      limit,
    );
  }

  async getReplies(
    viewer: ForumViewer,
    commentId: string,
    query: PaginationQueryDto,
  ) {
    const { page, limit } = query;
    const parent = await this.commentRepository.findOneBy({ id: commentId });

    if (!parent || parent.parentId) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    await this.postsService.findVisiblePost(viewer, parent.postId);

    const [replies, total] = await this.createVisibleCommentsQuery(viewer)
      .andWhere('comment.parentId = :parentId', { parentId: commentId })
      .orderBy('comment.createdAt', 'ASC')
      .addOrderBy('comment.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return createPaginatedResult(
      replies.map((reply) => this.presenter.toComment(reply, viewer)),
      total,
      page,
      limit,
    );
  }

  private createVisibleCommentsQuery(viewer: ForumViewer) {
    const query = this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author');

    if (!this.presenter.isAdmin(viewer)) {
      query.andWhere(
        new Brackets((visibility) => {
          visibility
            .where('comment.status = :published', {
              published: ForumCommentStatus.PUBLISHED,
            })
            .orWhere('comment.authorId = :viewerId', {
              viewerId: viewer.userId,
            });
        }),
      );
    }

    return query;
  }

  private async countReplies(
    viewer: ForumViewer,
    rootIds: string[],
  ): Promise<Map<string, number>> {
    if (rootIds.length === 0) return new Map();

    const rows = await this.createVisibleCommentsQuery(viewer)
      .select('comment.parentId', 'parentId')
      .addSelect('COUNT(*)', 'total')
      .andWhere('comment.parentId IN (:...rootIds)', { rootIds })
      .groupBy('comment.parentId')
      .getRawMany<{ parentId: string; total: string }>();

    return new Map(rows.map((row) => [row.parentId, Number(row.total)]));
  }

  private async loadReplyPreviews(
    viewer: ForumViewer,
    rootIds: string[],
  ): Promise<Map<string, ForumComment[]>> {
    const previews = new Map<string, ForumComment[]>();

    if (rootIds.length === 0) return previews;

    const isAdmin = this.presenter.isAdmin(viewer);
    const rankedIds: { id: string }[] = await this.dataSource.query(
      `SELECT id FROM (
        SELECT c.id, ROW_NUMBER() OVER (
          PARTITION BY c.parent_id ORDER BY c.created_at ASC, c.id ASC
        ) AS position
        FROM forum_comments c
        WHERE c.parent_id = ANY($1::uuid[])
          AND c.deleted_at IS NULL
          AND ($2::boolean OR c.status = $3 OR c.author_id = $4)
      ) ranked
      WHERE ranked.position <= $5`,
      [
        rootIds,
        isAdmin,
        ForumCommentStatus.PUBLISHED,
        viewer.userId,
        FORUM_REPLY_PREVIEW_LIMIT,
      ],
    );

    if (rankedIds.length === 0) return previews;

    const replies = await this.commentRepository.find({
      where: { id: In(rankedIds.map((row) => row.id)) },
      relations: { author: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    replies.forEach((reply) => {
      if (!reply.parentId) return;

      previews.set(reply.parentId, [
        ...(previews.get(reply.parentId) ?? []),
        reply,
      ]);
    });

    return previews;
  }

  async createComment(
    viewer: ForumViewer,
    postId: string,
    dto: CreateForumCommentDto,
  ) {
    await this.postsService.findPublishedPost(postId);

    const parentId = dto.parentId
      ? await this.resolveRootParentId(postId, dto.parentId)
      : null;
    const moderationFlags = await this.moderationService.assertContentAllowed(
      { content: dto.content },
      dto.acknowledgeWarnings === true,
    );
    const savedComment = await this.dataSource.transaction(async (manager) => {
      const comment = await manager.save(
        manager.create(ForumComment, {
          postId,
          authorId: viewer.userId,
          parentId,
          content: dto.content,
          moderationFlags,
        }),
      );

      await manager.increment(ForumPost, { id: postId }, 'commentCount', 1);

      return comment;
    });

    return this.getCommentDetail(viewer, savedComment.id);
  }

  async updateComment(
    viewer: ForumViewer,
    commentId: string,
    dto: UpdateForumCommentDto,
  ) {
    const comment = await this.findManageableComment(viewer, commentId);

    if (
      comment.status === ForumCommentStatus.HIDDEN &&
      !this.presenter.isAdmin(viewer)
    ) {
      throw new ForbiddenException(
        'Bình luận đang bị ẩn chờ quản trị viên xử lý, bạn chưa thể chỉnh sửa',
      );
    }

    comment.moderationFlags = await this.moderationService.assertContentAllowed(
      { content: dto.content },
      dto.acknowledgeWarnings === true,
    );
    comment.content = dto.content;

    await this.commentRepository.save(comment);

    return this.getCommentDetail(viewer, comment.id);
  }

  async deleteComment(viewer: ForumViewer, commentId: string): Promise<void> {
    const comment = await this.findManageableComment(viewer, commentId);

    await this.dataSource.transaction(async (manager) => {
      const replies = await manager.find(ForumComment, {
        where: { parentId: comment.id },
        select: { id: true, status: true },
      });
      const removedComments = [comment, ...replies];
      const removedVisibleCount = removedComments.filter(
        (item) => item.status === ForumCommentStatus.PUBLISHED,
      ).length;

      await manager.softDelete(ForumComment, {
        id: In(removedComments.map((item) => item.id)),
      });

      if (removedVisibleCount > 0) {
        await manager
          .createQueryBuilder()
          .update(ForumPost)
          .set({
            commentCount: () => 'GREATEST(comment_count - :removedCount, 0)',
          })
          .where('id = :postId', { postId: comment.postId })
          .setParameter('removedCount', removedVisibleCount)
          .execute();
      }
    });
  }

  private async getCommentDetail(viewer: ForumViewer, commentId: string) {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: { author: true },
    });

    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    return this.presenter.toComment(comment, viewer);
  }

  private async findManageableComment(
    viewer: ForumViewer,
    commentId: string,
  ): Promise<ForumComment> {
    const comment = await this.commentRepository.findOneBy({ id: commentId });

    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận');
    }

    if (!this.presenter.canManage(viewer, comment.authorId)) {
      throw new ForbiddenException(
        'Chỉ tác giả hoặc quản trị viên mới được sửa, xoá bình luận',
      );
    }

    return comment;
  }

  private async resolveRootParentId(
    postId: string,
    parentId: string,
  ): Promise<string> {
    const parent = await this.commentRepository.findOneBy({
      id: parentId,
      postId,
    });

    if (!parent) {
      throw new NotFoundException('Không tìm thấy bình luận được trả lời');
    }

    if (parent.status !== ForumCommentStatus.PUBLISHED) {
      throw new NotFoundException('Bình luận được trả lời không còn hiển thị');
    }

    return parent.parentId ?? parent.id;
  }
}

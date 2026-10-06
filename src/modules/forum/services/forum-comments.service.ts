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

    const commentsQuery = this.commentRepository
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.author', 'author')
      .where('comment.postId = :postId', { postId });

    if (!this.presenter.isAdmin(viewer)) {
      commentsQuery.andWhere(
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

    const [comments, total] = await commentsQuery
      .orderBy('comment.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return createPaginatedResult(
      comments.map((comment) => this.presenter.toComment(comment, viewer)),
      total,
      page,
      limit,
    );
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

    return parent.parentId ?? parent.id;
  }
}

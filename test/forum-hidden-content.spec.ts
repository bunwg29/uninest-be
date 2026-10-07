import { NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
}));

jest.mock('@core/storage', () => ({ R2StorageService: class {} }));
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));
jest.mock('../src/modules/forum/services/forum-moderation.service', () => ({
  ForumModerationService: class {},
}));

import { ForumCommentsService } from '../src/modules/forum/services/forum-comments.service';
import { ForumPostsService } from '../src/modules/forum/services/forum-posts.service';
import {
  ForumCommentStatus,
  type ForumComment,
  type ForumPost,
} from '../src/modules/forum/entities';

describe('Nội dung diễn đàn đã ẩn', () => {
  const viewer = { userId: 'user-1' } as never;
  const moderationService = {
    assertContentAllowed: jest.fn().mockResolvedValue([]),
  };

  beforeEach(() => jest.clearAllMocks());

  it('không cho trả lời bình luận đã ẩn', async () => {
    const commentRepository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'comment-1',
        postId: 'post-1',
        parentId: null,
        status: ForumCommentStatus.HIDDEN,
      }),
    } as unknown as Repository<ForumComment>;
    const postsService = {
      findPublishedPost: jest.fn().mockResolvedValue({ id: 'post-1' }),
    };
    const service = new ForumCommentsService(
      commentRepository,
      {} as DataSource,
      postsService as never,
      moderationService as never,
      {} as never,
    );

    await expect(
      service.createComment(viewer, 'post-1', {
        content: 'Trả lời',
        parentId: 'comment-1',
      } as never),
    ).rejects.toThrow('Bình luận được trả lời không còn hiển thị');
  });

  it('cho bỏ thích bài viết đã ẩn nhưng vẫn còn tồn tại', async () => {
    const postRepository = {
      findOneBy: jest.fn().mockResolvedValue({ id: 'post-1', likeCount: 0 }),
    } as unknown as Repository<ForumPost>;
    const manager = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      findOneByOrFail: jest.fn().mockResolvedValue({ likeCount: 3 }),
    };
    const dataSource = {
      transaction: jest.fn((callback: (m: unknown) => unknown) =>
        callback(manager),
      ),
    } as unknown as DataSource;
    const service = new ForumPostsService(
      postRepository,
      {} as never,
      dataSource,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.unlikePost(viewer, 'post-1')).resolves.toEqual({
      postId: 'post-1',
      isLiked: false,
      likeCount: 3,
    });
  });

  it('báo không tìm thấy khi bỏ thích bài viết đã bị xoá', async () => {
    const postRepository = {
      findOneBy: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<ForumPost>;
    const service = new ForumPostsService(
      postRepository,
      {} as never,
      {} as DataSource,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.unlikePost(viewer, 'post-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

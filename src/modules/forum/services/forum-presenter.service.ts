import { Injectable } from '@nestjs/common';
import { UserRoleType } from '@common/constants';
import { R2StorageService } from '@core/storage';
import { User } from '@modules/users/entities';
import {
  FORUM_CATEGORY_LABELS,
  ROOMMATE_GENDER_LABELS,
  ROOMMATE_STATUS_LABELS,
} from '../constants';
import { ForumComment, ForumPost } from '../entities';

export type ForumViewer = {
  userId: string;
  roleId: UserRoleType;
};

@Injectable()
export class ForumPresenterService {
  constructor(private readonly storageService: R2StorageService) {}

  isAdmin(viewer: ForumViewer): boolean {
    return viewer.roleId === UserRoleType.ADMIN;
  }

  canManage(viewer: ForumViewer, authorId: string): boolean {
    return viewer.userId === authorId || this.isAdmin(viewer);
  }

  toAuthor(author: User | undefined, authorId: string) {
    return {
      id: authorId,
      fullName: author?.fullName ?? 'Người dùng UniNest',
      avatarUrl: author?.avatarUrl
        ? this.storageService.getPublicUrl(author.avatarUrl)
        : null,
      school: author?.school ?? null,
      roleId: author?.roleId ?? null,
    };
  }

  toPost(post: ForumPost, viewer: ForumViewer, isLiked: boolean) {
    const roommate = post.roommate
      ? {
          ...post.roommate,
          genderLabel: ROOMMATE_GENDER_LABELS[post.roommate.gender],
        }
      : null;

    return {
      id: post.id,
      category: post.category,
      categoryLabel: FORUM_CATEGORY_LABELS[post.category],
      title: post.title,
      content: post.content,
      imageKeys: post.imageKeys,
      imageUrls: post.imageKeys.map((key) =>
        this.storageService.getPublicUrl(key),
      ),
      videoKey: post.videoKey,
      videoUrl: post.videoKey
        ? this.storageService.getPublicUrl(post.videoKey)
        : null,
      roommate,
      roommateStatus: post.roommateStatus,
      roommateStatusLabel: post.roommateStatus
        ? ROOMMATE_STATUS_LABELS[post.roommateStatus]
        : null,
      status: post.status,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      viewCount: post.viewCount,
      isLiked,
      isOwner: post.authorId === viewer.userId,
      canManage: this.canManage(viewer, post.authorId),
      author: this.toAuthor(post.author, post.authorId),
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  toComment(comment: ForumComment, viewer: ForumViewer) {
    return {
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      content: comment.content,
      status: comment.status,
      isOwner: comment.authorId === viewer.userId,
      canManage: this.canManage(viewer, comment.authorId),
      author: this.toAuthor(comment.author, comment.authorId),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}

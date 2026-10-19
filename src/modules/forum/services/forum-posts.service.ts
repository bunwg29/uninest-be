import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThan, Repository } from 'typeorm';
import { createPaginatedResult } from '@common/dtos';
import { escapeLikePattern } from '@common/utils';
import { R2StorageService } from '@core/storage';
import { LocationsService } from '@modules/locations/locations.service';
import {
  CreateForumPostDto,
  ForumPostsQueryDto,
  MyForumPostsQueryDto,
  RoommateCriteriaDto,
  UpdateForumPostDto,
} from '../dtos';
import {
  ForumCategory,
  ForumLike,
  ForumPost,
  ForumPostStatus,
  ForumPostView,
  RoommateCriteria,
  RoommateGender,
  RoommateStatus,
} from '../entities';
import { ForumModerationService } from './forum-moderation.service';
import { ForumPresenterService, ForumViewer } from './forum-presenter.service';

const FORUM_VIEW_THROTTLE_MS = 30 * 60 * 1000;

@Injectable()
export class ForumPostsService {
  private readonly logger = new Logger(ForumPostsService.name);

  constructor(
    @InjectRepository(ForumPost)
    private readonly postRepository: Repository<ForumPost>,
    @InjectRepository(ForumLike)
    private readonly likeRepository: Repository<ForumLike>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly moderationService: ForumModerationService,
    private readonly presenter: ForumPresenterService,
    private readonly storageService: R2StorageService,
    private readonly locationsService: LocationsService,
  ) {}

  async getFeed(viewer: ForumViewer, query: ForumPostsQueryDto) {
    const { page, limit } = query;
    const postsQuery = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.status = :status', { status: ForumPostStatus.PUBLISHED });

    if (query.category) {
      postsQuery.andWhere('post.category = :category', {
        category: query.category,
      });
    }

    if (query.keyword) {
      postsQuery.andWhere(
        '(post.title ILIKE :keyword OR post.content ILIKE :keyword)',
        { keyword: `%${escapeLikePattern(query.keyword)}%` },
      );
    }

    if (query.gender) {
      const genders =
        query.gender === RoommateGender.ANY
          ? [RoommateGender.ANY]
          : [query.gender, RoommateGender.ANY];

      postsQuery.andWhere(`post.roommate ->> 'gender' IN (:...genders)`, {
        genders,
      });
    }

    if (query.maxCost !== undefined) {
      postsQuery.andWhere(
        `(post.roommate ->> 'costPerPerson')::numeric <= :maxCost`,
        { maxCost: query.maxCost },
      );
    }

    if (query.area) {
      postsQuery.andWhere(
        `(post.roommate ->> 'area' ILIKE :area OR post.title ILIKE :area OR post.content ILIKE :area)`,
        { area: `%${escapeLikePattern(query.area)}%` },
      );
    }

    if (query.provinceCode) {
      postsQuery.andWhere(`post.roommate ->> 'provinceCode' = :provinceCode`, {
        provinceCode: query.provinceCode,
      });
    }

    if (query.wardCode) {
      postsQuery.andWhere(`post.roommate ->> 'wardCode' = :wardCode`, {
        wardCode: query.wardCode,
      });
    }

    if (query.roommateStatus) {
      postsQuery.andWhere('post.roommateStatus = :roommateStatus', {
        roommateStatus: query.roommateStatus,
      });
    }

    if (query.moveInBefore) {
      postsQuery.andWhere(`post.roommate ->> 'moveInDate' <= :moveInBefore`, {
        moveInBefore: query.moveInBefore,
      });
    }

    if (query.sortBy === 'popular') {
      postsQuery
        .orderBy('post.likeCount', 'DESC')
        .addOrderBy('post.commentCount', 'DESC')
        .addOrderBy('post.publishedAt', 'DESC');
    } else {
      postsQuery.orderBy('post.publishedAt', 'DESC');
    }

    const [posts, total] = await postsQuery
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return createPaginatedResult(
      await this.presentPosts(posts, viewer),
      total,
      page,
      limit,
    );
  }

  async getMyPosts(viewer: ForumViewer, query: MyForumPostsQueryDto) {
    const { page, limit } = query;
    const [posts, total] = await this.postRepository.findAndCount({
      where: {
        authorId: viewer.userId,
        ...(query.status ? { status: query.status } : {}),
      },
      relations: { author: true },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return createPaginatedResult(
      await this.presentPosts(posts, viewer),
      total,
      page,
      limit,
    );
  }

  async getPostDetail(viewer: ForumViewer, postId: string) {
    const post = await this.findVisiblePost(viewer, postId);

    if (
      post.status === ForumPostStatus.PUBLISHED &&
      post.authorId !== viewer.userId
    ) {
      const isCounted = await this.recordView(post.id, viewer.userId);

      if (isCounted) post.viewCount += 1;
    }

    const [presentedPost] = await this.presentPosts([post], viewer);

    return presentedPost;
  }

  private recordView(postId: string, viewerId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `forum-post-view:${viewerId}:${postId}`,
      ]);

      const hasRecentView = await manager.existsBy(ForumPostView, {
        postId,
        viewerId,
        createdAt: MoreThan(new Date(Date.now() - FORUM_VIEW_THROTTLE_MS)),
      });

      if (hasRecentView) return false;

      await manager.increment(ForumPost, { id: postId }, 'viewCount', 1);
      await manager.insert(ForumPostView, { postId, viewerId });

      return true;
    });
  }

  async createPost(viewer: ForumViewer, dto: CreateForumPostDto) {
    const isDraft = dto.isDraft === true;
    const roommate = await this.resolveRoommate(dto.category, dto.roommate);
    const moderationFlags = isDraft
      ? []
      : await this.moderationService.assertContentAllowed(
          this.moderationService.extractModeratedContent(dto),
          dto.acknowledgeWarnings === true,
        );
    const imageKeys = [...new Set(dto.imageKeys ?? [])];

    const videoKey = dto.videoKey ?? null;

    await this.assertImagesUsable(imageKeys, [], null);
    await this.assertVideoUsable(videoKey, null, null);

    const post = this.postRepository.create({
      authorId: viewer.userId,
      category: dto.category,
      title: dto.title,
      content: dto.content,
      imageKeys,
      videoKey,
      roommate,
      roommateStatus: roommate
        ? (dto.roommateStatus ?? RoommateStatus.OPEN)
        : null,
      status: isDraft ? ForumPostStatus.DRAFT : ForumPostStatus.PUBLISHED,
      moderationFlags,
      publishedAt: isDraft ? null : new Date(),
    });
    const savedPost = await this.postRepository.save(post);

    return this.getPostDetail(viewer, savedPost.id);
  }

  async updatePost(
    viewer: ForumViewer,
    postId: string,
    dto: UpdateForumPostDto,
  ) {
    const post = await this.findManageablePost(viewer, postId);

    if (
      post.status === ForumPostStatus.HIDDEN &&
      !this.presenter.isAdmin(viewer)
    ) {
      throw new ForbiddenException(
        'Bài viết đang bị ẩn chờ quản trị viên xử lý, bạn chưa thể chỉnh sửa',
      );
    }

    if (dto.isDraft === true && post.status !== ForumPostStatus.DRAFT) {
      throw new BadRequestException(
        'Không thể chuyển bài viết đã đăng về bản nháp',
      );
    }

    const previousImageKeys = post.imageKeys;
    const previousVideoKey = post.videoKey;
    const category = dto.category ?? post.category;
    const roommate =
      dto.roommate !== undefined
        ? await this.resolveRoommate(category, dto.roommate)
        : await this.resolveRoommate(category, post.roommate ?? undefined);
    const shouldPublish =
      post.status === ForumPostStatus.DRAFT && dto.isDraft === false;
    const nextStatus = shouldPublish ? ForumPostStatus.PUBLISHED : post.status;

    const nextImageKeys =
      dto.imageKeys !== undefined
        ? [...new Set(dto.imageKeys)]
        : post.imageKeys;

    const nextVideoKey =
      dto.videoKey !== undefined ? dto.videoKey : previousVideoKey;

    await this.assertImagesUsable(nextImageKeys, previousImageKeys, post.id);
    await this.assertVideoUsable(nextVideoKey, previousVideoKey, post.id);

    post.category = category;
    post.title = dto.title ?? post.title;
    post.content = dto.content ?? post.content;
    post.imageKeys = nextImageKeys;
    post.videoKey = nextVideoKey;
    post.roommate = roommate;
    post.roommateStatus = roommate
      ? (dto.roommateStatus ?? post.roommateStatus ?? RoommateStatus.OPEN)
      : null;

    if (nextStatus === ForumPostStatus.PUBLISHED) {
      post.moderationFlags = await this.moderationService.assertContentAllowed(
        this.moderationService.extractModeratedContent(post),
        dto.acknowledgeWarnings === true,
      );
    }

    if (shouldPublish) {
      post.status = ForumPostStatus.PUBLISHED;
      post.publishedAt = new Date();
    }

    await this.postRepository.save(post);
    await this.deleteRemovedFiles(previousImageKeys, post.imageKeys);
    await this.deleteRemovedFiles(
      previousVideoKey ? [previousVideoKey] : [],
      post.videoKey ? [post.videoKey] : [],
    );

    const [presentedPost] = await this.presentPosts([post], viewer);

    return presentedPost;
  }

  async deletePost(viewer: ForumViewer, postId: string): Promise<void> {
    const post = await this.findManageablePost(viewer, postId);

    await this.postRepository.softDelete({ id: post.id });
  }

  async likePost(viewer: ForumViewer, postId: string) {
    await this.findPublishedPost(postId);

    return this.dataSource.transaction(async (manager) => {
      const insertResult = await manager
        .createQueryBuilder()
        .insert()
        .into(ForumLike)
        .values({ postId, userId: viewer.userId })
        .orIgnore()
        .returning(['id'])
        .execute();
      const isNewLike =
        Array.isArray(insertResult.raw) && insertResult.raw.length > 0;

      if (isNewLike) {
        await manager.increment(ForumPost, { id: postId }, 'likeCount', 1);
      }

      const post = await manager.findOneByOrFail(ForumPost, { id: postId });

      return { postId, isLiked: true, likeCount: post.likeCount };
    });
  }

  async unlikePost(viewer: ForumViewer, postId: string) {
    const existingPost = await this.postRepository.findOneBy({ id: postId });

    if (!existingPost) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    return this.dataSource.transaction(async (manager) => {
      const deleteResult = await manager.delete(ForumLike, {
        postId,
        userId: viewer.userId,
      });

      if (deleteResult.affected) {
        await manager
          .createQueryBuilder()
          .update(ForumPost)
          .set({ likeCount: () => 'GREATEST(like_count - 1, 0)' })
          .where('id = :postId', { postId })
          .execute();
      }

      const post = await manager.findOneByOrFail(ForumPost, { id: postId });

      return { postId, isLiked: false, likeCount: post.likeCount };
    });
  }

  async findPublishedPost(postId: string): Promise<ForumPost> {
    const post = await this.postRepository.findOneBy({
      id: postId,
      status: ForumPostStatus.PUBLISHED,
    });

    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    return post;
  }

  async findVisiblePost(
    viewer: ForumViewer,
    postId: string,
  ): Promise<ForumPost> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: { author: true },
    });
    const canView =
      post &&
      (post.status === ForumPostStatus.PUBLISHED ||
        this.presenter.canManage(viewer, post.authorId));

    if (!post || !canView) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    return post;
  }

  private async findManageablePost(
    viewer: ForumViewer,
    postId: string,
  ): Promise<ForumPost> {
    const post = await this.postRepository.findOne({
      where: { id: postId },
      relations: { author: true },
    });

    if (!post) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }

    if (!this.presenter.canManage(viewer, post.authorId)) {
      throw new ForbiddenException(
        'Chỉ tác giả hoặc quản trị viên mới được sửa, xoá bài viết',
      );
    }

    return post;
  }

  private async resolveRoommate(
    category: ForumCategory,
    roommate: RoommateCriteriaDto | RoommateCriteria | undefined,
  ): Promise<RoommateCriteria | null> {
    if (category !== ForumCategory.ROOMMATE) {
      return null;
    }

    if (!roommate) {
      throw new BadRequestException(
        'Bài tìm bạn ở ghép phải có tiêu chí ở ghép',
      );
    }

    const location = await this.resolveRoommateLocation(roommate);

    return {
      gender: roommate.gender,
      costPerPerson: roommate.costPerPerson,
      costNote: roommate.costNote ?? null,
      moveInDate: roommate.moveInDate ?? null,
      minStayMonths: roommate.minStayMonths ?? null,
      lifestyle: roommate.lifestyle ?? null,
      smoking: roommate.smoking ?? null,
      tidiness: roommate.tidiness ?? null,
      bedtime: roommate.bedtime ?? null,
      pets: roommate.pets ?? null,
      cooking: roommate.cooking ?? null,
      area: location?.area ?? roommate.area ?? null,
      provinceCode: location?.provinceCode ?? null,
      wardCode: location?.wardCode ?? null,
      provinceName: location?.provinceName ?? null,
      wardName: location?.wardName ?? null,
      streetAddress: location?.streetAddress ?? null,
    };
  }

  private async resolveRoommateLocation(
    roommate: RoommateCriteriaDto | RoommateCriteria,
  ) {
    const { provinceCode, wardCode } = roommate;

    if (!provinceCode && !wardCode) return null;

    if (!provinceCode || !wardCode) {
      throw new BadRequestException(
        'Vui lòng chọn đầy đủ tỉnh/thành phố và phường/xã cho khu vực',
      );
    }

    const ward = await this.locationsService.getWardByCode(wardCode);

    if (ward.provinceCode !== provinceCode) {
      throw new BadRequestException(
        'Phường/xã không thuộc tỉnh/thành phố đã chọn',
      );
    }

    const streetAddress = roommate.streetAddress?.trim() || null;

    return {
      provinceCode,
      wardCode,
      provinceName: ward.province?.fullName ?? null,
      wardName: ward.fullName,
      streetAddress,
      area: await this.locationsService.formatFullAddress(
        provinceCode,
        wardCode,
        streetAddress,
      ),
    };
  }

  private async presentPosts(posts: ForumPost[], viewer: ForumViewer) {
    const postIds = posts.map((post) => post.id);
    const likes = postIds.length
      ? await this.likeRepository.find({
          where: { postId: In(postIds), userId: viewer.userId },
          select: { postId: true },
        })
      : [];
    const likedPostIds = new Set(likes.map((like) => like.postId));

    return posts.map((post) =>
      this.presenter.toPost(post, viewer, likedPostIds.has(post.id)),
    );
  }

  private async assertImagesUsable(
    nextImageKeys: string[],
    previousImageKeys: string[],
    postId: string | null,
  ): Promise<void> {
    const previousKeys = new Set(previousImageKeys);
    const addedKeys = nextImageKeys.filter((key) => !previousKeys.has(key));

    if (!addedKeys.length) {
      return;
    }

    const usedQuery = this.postRepository
      .createQueryBuilder('post')
      .withDeleted()
      .where('post.imageKeys && CAST(:addedKeys AS text[])', { addedKeys });

    if (postId) {
      usedQuery.andWhere('post.id != :postId', { postId });
    }

    if (await usedQuery.getExists()) {
      throw new BadRequestException(
        'Ảnh đã được sử dụng ở bài viết khác, vui lòng tải ảnh mới lên',
      );
    }

    await Promise.all(
      addedKeys.map((key) => this.storageService.assertValidImageObject(key)),
    );
  }

  private async assertVideoUsable(
    nextVideoKey: string | null,
    previousVideoKey: string | null,
    postId: string | null,
  ): Promise<void> {
    if (!nextVideoKey || nextVideoKey === previousVideoKey) {
      return;
    }

    const usedQuery = this.postRepository
      .createQueryBuilder('post')
      .withDeleted()
      .where('post.videoKey = :nextVideoKey', { nextVideoKey });

    if (postId) {
      usedQuery.andWhere('post.id != :postId', { postId });
    }

    if (await usedQuery.getExists()) {
      throw new BadRequestException(
        'Video đã được sử dụng ở bài viết khác, vui lòng tải video mới lên',
      );
    }

    await this.storageService.assertValidVideoObject(nextVideoKey);
  }

  private async deleteRemovedFiles(
    previousImageKeys: string[],
    nextImageKeys: string[],
  ): Promise<void> {
    const nextKeys = new Set(nextImageKeys);
    const removedKeys = previousImageKeys.filter((key) => !nextKeys.has(key));

    if (!removedKeys.length) {
      return;
    }

    const results = await Promise.all(
      removedKeys.map((key) => this.storageService.deleteFile(key)),
    );

    if (results.some((isDeleted) => !isDeleted)) {
      this.logger.warn(
        `Failed to delete some post media from R2: ${removedKeys.join(', ')}`,
      );
    }
  }
}

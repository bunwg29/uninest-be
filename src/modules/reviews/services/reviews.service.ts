import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { createPaginatedResult } from '@common/dtos';
import { R2StorageService } from '@core/storage';
import { Report, ReportEntityType } from '@modules/admin/entities';
import { Booking, BookingStatus } from '@modules/booking/entities';
import { ForumModerationService } from '@modules/forum/services/forum-moderation.service';
import { Listing } from '@modules/listings/entities';
import { REVIEW_LIMITS } from '../constants';
import {
  CreateReviewDto,
  ReplyReviewDto,
  ReportReviewDto,
  ReviewListQueryDto,
  UpdateReviewDto,
} from '../dtos';
import { Review } from '../entities';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly dataSource: DataSource,
    private readonly moderationService: ForumModerationService,
    private readonly storageService: R2StorageService,
  ) {}

  async getEligibility(studentId: string, listingId: string) {
    const existingReview = await this.reviewRepository.findOne({
      where: { studentId, listingId },
      select: { id: true, editedUntil: true },
      withDeleted: true,
    });

    if (existingReview) {
      return {
        eligible: false,
        reason: 'already_reviewed',
        reviewId: existingReview.id,
        editableUntil: existingReview.editedUntil,
      };
    }

    const booking = await this.findEligibleBooking(studentId, listingId);

    return booking
      ? { eligible: true, bookingId: booking.id, viewedAt: booking.endTime }
      : { eligible: false, reason: 'viewing_history_required' };
  }

  async create(studentId: string, listingId: string, dto: CreateReviewDto) {
    const comment = dto.comment?.trim() || null;

    await this.assertContentAllowed(comment, dto.acknowledgeWarnings);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const booking = await manager.findOne(Booking, {
          where: {
            id: dto.bookingId,
            userId: studentId,
            listingId,
            status: BookingStatus.CONFIRMED,
          },
          lock: { mode: 'pessimistic_write' },
        });

        if (!booking || booking.endTime > new Date()) {
          throw new ForbiddenException(
            'Bạn chỉ có thể đánh giá sau lịch xem phòng đã được xác nhận',
          );
        }

        const duplicated = await manager.exists(Review, {
          where: [{ studentId, listingId }, { bookingId: booking.id }],
          withDeleted: true,
        });

        if (duplicated) {
          throw new ConflictException('Bạn đã đánh giá tin đăng này');
        }

        const now = new Date();
        const editedUntil = new Date(now);

        editedUntil.setDate(
          editedUntil.getDate() + REVIEW_LIMITS.EDIT_WINDOW_DAYS,
        );

        const review = manager.create(Review, {
          listingId,
          bookingId: booking.id,
          studentId,
          ...this.pickRatings(dto),
          averageRating: String(this.calculateAverage(dto)),
          comment,
          editedUntil,
          landlordReply: null,
          repliedAt: null,
        });
        const savedReview = await manager.save(Review, review);

        await this.recalculateListingRating(manager, listingId);

        return this.present(savedReview);
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError: unknown = error.driverError;

        if (this.hasDatabaseErrorCode(driverError, '23505')) {
          throw new ConflictException('Bạn đã đánh giá tin đăng này');
        }
      }

      throw error;
    }
  }

  async update(studentId: string, reviewId: string, dto: UpdateReviewDto) {
    const comment = dto.comment?.trim() || null;

    if (dto.comment !== undefined) {
      await this.assertContentAllowed(comment, dto.acknowledgeWarnings);
    }

    return this.dataSource.transaction(async (manager) => {
      const review = await manager.findOne(Review, {
        where: { id: reviewId, studentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!review) {
        throw new NotFoundException('Không tìm thấy đánh giá của bạn');
      }

      if (review.editedUntil < new Date()) {
        throw new ForbiddenException('Đã hết thời hạn 7 ngày để sửa đánh giá');
      }

      const ratings = {
        locationRating: dto.locationRating ?? review.locationRating,
        valueRating: dto.valueRating ?? review.valueRating,
        landlordRating: dto.landlordRating ?? review.landlordRating,
        amenitiesRating: dto.amenitiesRating ?? review.amenitiesRating,
      };

      Object.assign(review, ratings, {
        averageRating: String(this.calculateAverage(ratings)),
        comment: dto.comment === undefined ? review.comment : comment,
      });

      const savedReview = await manager.save(Review, review);

      await this.recalculateListingRating(manager, review.listingId);

      return this.present(savedReview);
    });
  }

  async list(listingId: string, query: ReviewListQueryDto) {
    const builder = this.reviewRepository
      .createQueryBuilder('review')
      .innerJoinAndSelect('review.student', 'student')
      .where('review.listingId = :listingId', { listingId });

    if (query.stars) {
      builder.andWhere('ROUND(review.averageRating) = :stars', {
        stars: query.stars,
      });
    }

    const [reviews, total] = await builder
      .orderBy('review.createdAt', 'DESC')
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getManyAndCount();
    const summary = await this.getSummary(listingId);

    return {
      ...createPaginatedResult(
        reviews.map((review) => this.present(review)),
        total,
        query.page,
        query.limit,
      ),
      summary,
    };
  }

  async reply(landlordId: string, reviewId: string, dto: ReplyReviewDto) {
    const content = dto.content.trim();

    await this.assertContentAllowed(content, dto.acknowledgeWarnings);

    return this.dataSource.transaction(async (manager) => {
      const review = await manager.findOne(Review, {
        where: { id: reviewId },
        relations: { listing: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!review) {
        throw new NotFoundException('Không tìm thấy đánh giá');
      }

      if (review.listing.ownerId !== landlordId) {
        throw new ForbiddenException(
          'Bạn không có quyền phản hồi đánh giá này',
        );
      }

      if (review.landlordReply) {
        throw new ConflictException('Đánh giá này đã được phản hồi');
      }

      review.landlordReply = content;
      review.repliedAt = new Date();

      return this.present(await manager.save(Review, review));
    });
  }

  async report(landlordId: string, reviewId: string, dto: ReportReviewDto) {
    const review = await this.reviewRepository
      .createQueryBuilder('review')
      .innerJoinAndSelect('review.listing', 'listing')
      .where('review.id = :reviewId', { reviewId })
      .getOne();

    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    if (review.listing.ownerId !== landlordId) {
      throw new ForbiddenException('Bạn không có quyền báo cáo đánh giá này');
    }

    const result = await this.dataSource
      .getRepository(Report)
      .createQueryBuilder()
      .insert()
      .values({
        reporterId: landlordId,
        entityType: ReportEntityType.REVIEW,
        entityId: reviewId,
        reason: dto.reason.trim(),
        note: dto.note?.trim() || null,
      })
      .orIgnore()
      .returning(['id'])
      .execute();

    if (!Array.isArray(result.raw) || result.raw.length === 0) {
      throw new ConflictException('Bạn đã báo cáo đánh giá này trước đó');
    }

    return { reviewId, reported: true };
  }

  private async findEligibleBooking(studentId: string, listingId: string) {
    const booking = await this.dataSource.getRepository(Booking).findOne({
      where: {
        userId: studentId,
        listingId,
        status: BookingStatus.CONFIRMED,
      },
      order: { endTime: 'DESC' },
    });

    return booking && booking.endTime <= new Date() ? booking : null;
  }

  private async getSummary(listingId: string) {
    const rows = await this.reviewRepository
      .createQueryBuilder('review')
      .select('ROUND(review.averageRating)', 'stars')
      .addSelect('COUNT(*)', 'count')
      .where('review.listingId = :listingId', { listingId })
      .groupBy('ROUND(review.averageRating)')
      .getRawMany<{ stars: string; count: string }>();
    const listing = await this.dataSource.getRepository(Listing).findOne({
      where: { id: listingId },
      select: { id: true, averageRating: true, reviewCount: true },
    });

    if (!listing) throw new NotFoundException('Không tìm thấy tin đăng');

    const distribution = Object.fromEntries(
      [1, 2, 3, 4, 5].map((stars) => [stars, 0]),
    ) as Record<number, number>;

    rows.forEach((row) => {
      distribution[Number(row.stars)] = Number(row.count);
    });

    return {
      averageRating: Number(listing.averageRating),
      reviewCount: listing.reviewCount,
      distribution,
    };
  }

  private async recalculateListingRating(
    manager: EntityManager,
    listingId: string,
  ): Promise<void> {
    const row = await manager
      .getRepository(Review)
      .createQueryBuilder('review')
      .select('COALESCE(AVG(review.averageRating), 0)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.listingId = :listingId', { listingId })
      .getRawOne<{ average: string; count: string }>();

    await manager.update(
      Listing,
      { id: listingId },
      {
        averageRating: Number(row?.average ?? 0).toFixed(2),
        reviewCount: Number(row?.count ?? 0),
      },
    );
  }

  private async assertContentAllowed(
    content: string | null,
    acknowledgeWarnings = false,
  ): Promise<void> {
    if (!content) return;

    await this.moderationService.assertContentAllowed(
      { content },
      acknowledgeWarnings,
    );
  }

  private pickRatings(dto: CreateReviewDto) {
    return {
      locationRating: dto.locationRating,
      valueRating: dto.valueRating,
      landlordRating: dto.landlordRating,
      amenitiesRating: dto.amenitiesRating,
    };
  }

  private calculateAverage(ratings: {
    locationRating: number;
    valueRating: number;
    landlordRating: number;
    amenitiesRating: number;
  }): number {
    return Number(
      (
        (ratings.locationRating +
          ratings.valueRating +
          ratings.landlordRating +
          ratings.amenitiesRating) /
        4
      ).toFixed(2),
    );
  }

  private present(review: Review) {
    return {
      id: review.id,
      listingId: review.listingId,
      bookingId: review.bookingId,
      student: review.student
        ? {
            id: review.student.id,
            fullName: review.student.fullName,
            avatarUrl: review.student.avatarUrl
              ? this.storageService.getPublicUrl(review.student.avatarUrl)
              : null,
          }
        : undefined,
      locationRating: review.locationRating,
      valueRating: review.valueRating,
      landlordRating: review.landlordRating,
      amenitiesRating: review.amenitiesRating,
      averageRating: Number(review.averageRating),
      comment: review.comment,
      editedUntil: review.editedUntil,
      landlordReply: review.landlordReply,
      repliedAt: review.repliedAt,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  private hasDatabaseErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    );
  }
}

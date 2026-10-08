import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  MoreThan,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  ACTIVE_BOOKING_STATUSES,
  Booking,
  BookingEvent,
  BookingStatus,
  findActiveHolds,
  type ListingHoldInfo,
} from '@modules/booking';
import { UserRoleType } from '@common/constants';
import { R2StorageService } from '@core/storage';
import { Conversation } from '@modules/chat/entities';
import { Province, Ward } from '@modules/locations/entities';
import { User } from '@modules/users/entities';
import {
  Amenity,
  Favorite,
  Listing,
  ListingAmenity,
  ListingImage,
  ListingReport,
  ListingStatus,
  ListingView,
} from '../entities';
import {
  CreateListingDto,
  LANDLORD_STATS_PERIOD_DAYS,
  LandlordListingsQueryDto,
  type LandlordStatsPeriod,
  ReportListingDto,
} from '../dtos';

const VIEW_THROTTLE_MINUTES = 30;
const VIEW_THROTTLE_MILLISECONDS = VIEW_THROTTLE_MINUTES * 60 * 1000;

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Amenity)
    private readonly amenityRepository: Repository<Amenity>,
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(Ward)
    private readonly wardRepository: Repository<Ward>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly storageService: R2StorageService,
  ) {}

  async createListing(userId: string, dto: CreateListingDto): Promise<Listing> {
    await this.assertLandlordVerified(userId);

    const province = await this.provinceRepository.findOneBy({
      code: dto.provinceCode,
    });

    if (!province) {
      throw new NotFoundException('Không tìm thấy tỉnh/thành phố');
    }

    const ward = await this.wardRepository.findOneBy({ code: dto.wardCode });

    if (!ward) {
      throw new NotFoundException('Không tìm thấy phường/xã');
    }

    if (ward.provinceCode !== province.code) {
      throw new BadRequestException(
        'Phường/xã không thuộc tỉnh/thành phố đã chọn',
      );
    }

    await this.assertImagesValid(dto.images?.map((image) => image.key));
    await this.assertVideoValid(dto.videoKey);

    const amenityIds = [...new Set(dto.amenityIds ?? [])];
    const amenities = amenityIds.length
      ? await this.amenityRepository.findBy({ id: In(amenityIds) })
      : [];

    if (amenities.length !== amenityIds.length) {
      throw new NotFoundException('Một hoặc nhiều tiện ích không tồn tại');
    }

    if (amenities.some((amenity) => !amenity.isActive)) {
      throw new BadRequestException(
        'Một hoặc nhiều tiện ích đã bị vô hiệu hóa',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const listing = manager.create(Listing, {
        ownerId: userId,
        title: dto.title,
        description: dto.description ?? null,
        roomType: dto.roomType,
        price: String(dto.price),
        area: String(dto.area),
        maxOccupants: dto.maxOccupants,
        electricPrice:
          dto.electricPrice === undefined ? null : String(dto.electricPrice),
        waterPrice:
          dto.waterPrice === undefined ? null : String(dto.waterPrice),
        deposit: dto.deposit === undefined ? null : String(dto.deposit),
        streetAddress: dto.streetAddress,
        provinceCode: province.code,
        wardCode: ward.code,
        fullAddress: `${dto.streetAddress}, ${ward.fullName}, ${province.fullName}`,
        location: {
          type: 'Point',
          coordinates: [dto.longitude, dto.latitude],
        },
        status: ListingStatus.PENDING,
        videoKey: dto.videoKey ?? null,
        viewingSchedule: dto.viewingSchedule
          ? { ...dto.viewingSchedule }
          : null,
      });

      const savedListing = await manager.save(Listing, listing);

      if (dto.images?.length) {
        const coverCount = dto.images.filter((image) => image.isCover).length;

        if (coverCount > 1) {
          throw new BadRequestException('Tin đăng chỉ được có một ảnh bìa');
        }

        const hasCover = coverCount === 1;
        const images = dto.images.map((image, index) =>
          manager.create(ListingImage, {
            listingId: savedListing.id,
            url: image.key,
            isCover: hasCover ? image.isCover === true : index === 0,
            sortOrder: index,
          }),
        );

        await manager.save(ListingImage, images);
      }

      if (amenities.length) {
        const listingAmenities = amenities.map((amenity) =>
          manager.create(ListingAmenity, {
            listingId: savedListing.id,
            amenityId: amenity.id,
          }),
        );

        await manager.save(ListingAmenity, listingAmenities);
      }

      const createdListing = await manager.findOne(Listing, {
        where: { id: savedListing.id },
        relations: {
          images: true,
          listingAmenities: { amenity: true },
        },
      });

      if (!createdListing) {
        throw new NotFoundException('Không tìm thấy tin đăng vừa tạo');
      }

      return createdListing;
    });
  }

  async getLandlordListings(userId: string, query: LandlordListingsQueryDto) {
    const { keyword, limit, page, sortBy, status } = query;
    const listingsQuery = this.listingRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'image')
      .leftJoinAndSelect('listing.province', 'province')
      .leftJoinAndSelect('listing.ward', 'ward')
      .leftJoinAndSelect('listing.listingAmenities', 'listingAmenity')
      .where('listing.ownerId = :userId', { userId });

    if (status === 'all' || status === 'deleted') {
      listingsQuery.withDeleted();
    }

    if (status === 'deleted') {
      listingsQuery.andWhere('listing.deletedAt IS NOT NULL');
    } else if (status && status !== 'all') {
      listingsQuery.andWhere('listing.status = :status', { status });
    }

    if (keyword) {
      listingsQuery.andWhere(
        '(listing.title ILIKE :keyword OR listing.fullAddress ILIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (sortBy === 'oldest') {
      listingsQuery.orderBy('listing.createdAt', 'ASC');
    } else if (sortBy === 'price_asc') {
      listingsQuery.orderBy('listing.price', 'ASC');
    } else if (sortBy === 'price_desc') {
      listingsQuery.orderBy('listing.price', 'DESC');
    } else {
      listingsQuery.orderBy('listing.updatedAt', 'DESC');
    }

    const [listings, totalCount] = await listingsQuery
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const engagement = await this.loadEngagementCounts(
      listings.map((listing) => listing.id),
    );
    const counterRows = await this.listingRepository
      .createQueryBuilder('listing')
      .select('listing.status', 'status')
      .addSelect('COUNT(listing.id)', 'count')
      .where('listing.ownerId = :userId', { userId })
      .groupBy('listing.status')
      .getRawMany<{ status: ListingStatus; count: string }>();
    const counters: Record<ListingStatus | 'deleted', number> = {
      [ListingStatus.PENDING]: 0,
      [ListingStatus.ACTIVE]: 0,
      [ListingStatus.REJECTED]: 0,
      [ListingStatus.HIDDEN]: 0,
      [ListingStatus.RENTED]: 0,
      [ListingStatus.PAUSED]: 0,
      deleted: 0,
    };

    counterRows.forEach((row) => {
      counters[row.status] = Number(row.count);
    });

    counters.deleted = await this.listingRepository
      .createQueryBuilder('listing')
      .withDeleted()
      .where('listing.ownerId = :userId', { userId })
      .andWhere('listing.deletedAt IS NOT NULL')
      .getCount();

    return {
      items: listings.map((listing) =>
        this.toLandlordListing(listing, engagement.get(listing.id)),
      ),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      countsByStatus: counters,
    };
  }

  async getLandlordListing(userId: string, id: string) {
    const listing = await this.listingRepository.findOne({
      where: { id, ownerId: userId },
      relations: {
        images: true,
        province: true,
        ward: true,
        listingAmenities: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng của bạn');
    }

    const [saveCount, contactCount, bookingCount] = await Promise.all([
      this.favoriteRepository.countBy({ listingId: id }),
      this.dataSource.getRepository(Conversation).countBy({ listingId: id }),
      this.dataSource.getRepository(Booking).countBy({ listingId: id }),
    ]);

    return {
      ...this.toLandlordListing(listing),
      saveCount,
      contactCount,
      bookingCount,
    };
  }

  async getListingDetail(userId: string, roleId: UserRoleType, id: string) {
    const [listing, isFavorite] = await Promise.all([
      this.createDetailQuery(id).getOne(),
      this.favoriteRepository.existsBy({ userId, listingId: id }),
    ]);

    const myBooking =
      roleId === UserRoleType.STUDENT && listing
        ? await this.findMyActiveBooking(userId, listing.id)
        : null;

    if (
      listing &&
      listing.status !== ListingStatus.ACTIVE &&
      roleId === UserRoleType.STUDENT &&
      (await this.hasListingHistory(userId, listing.id))
    ) {
      return this.toListingDetail(
        listing,
        isFavorite,
        undefined,
        false,
        myBooking,
      );
    }

    this.assertCanAccessListing(listing, userId, roleId);

    const holds = await findActiveHolds(this.dataSource, [listing.id]);
    const canSeeStats =
      listing.ownerId === userId || roleId === UserRoleType.ADMIN;

    return this.toListingDetail(
      listing,
      isFavorite,
      holds.get(listing.id),
      canSeeStats,
      myBooking,
    );
  }

  async recordView(userId: string, roleId: UserRoleType, id: string) {
    const listing = await this.listingRepository.findOneBy({ id });

    this.assertCanAccessListing(listing, userId, roleId);

    const canSeeStats =
      listing.ownerId === userId || roleId === UserRoleType.ADMIN;

    if (canSeeStats) {
      return { viewCount: listing.viewCount, incremented: false };
    }

    const incremented = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `listing-view:${userId}:${id}`,
      ]);

      const recentView = await manager.existsBy(ListingView, {
        listingId: id,
        viewerId: userId,
        createdAt: MoreThan(new Date(Date.now() - VIEW_THROTTLE_MILLISECONDS)),
      });

      if (recentView) return false;

      await manager.increment(Listing, { id }, 'viewCount', 1);
      await manager.insert(ListingView, { listingId: id, viewerId: userId });

      return true;
    });

    return { viewCount: null, incremented };
  }

  async getLandlordStats(userId: string, period: LandlordStatsPeriod) {
    const since =
      period === 'all'
        ? null
        : new Date(
            Date.now() -
              LANDLORD_STATS_PERIOD_DAYS[period] * 24 * 60 * 60 * 1000,
          );

    const [views, conversations, bookings, pendingBookings] = await Promise.all(
      [
        this.countLandlordViews(userId, since),
        this.countLandlordConversations(userId, since),
        this.countLandlordBookings(userId, since),
        this.countLandlordBookings(userId, null, BookingStatus.PENDING),
      ],
    );

    return {
      period,
      since: since?.toISOString() ?? null,
      views,
      contacts: conversations + bookings,
      conversations,
      bookings,
      pendingBookings,
    };
  }

  private async countLandlordViews(
    userId: string,
    since: Date | null,
  ): Promise<number> {
    if (!since) {
      const total = await this.listingRepository
        .createQueryBuilder('listing')
        .select('COALESCE(SUM(listing.viewCount), 0)', 'total')
        .where('listing.ownerId = :userId', { userId })
        .getRawOne<{ total: string }>();

      return Number(total?.total ?? 0);
    }

    return this.dataSource
      .getRepository(ListingView)
      .createQueryBuilder('listingView')
      .innerJoin(Listing, 'listing', 'listing.id = listingView.listingId')
      .where('listing.ownerId = :userId', { userId })
      .andWhere('listingView.createdAt >= :since', { since })
      .getCount();
  }

  private countLandlordConversations(
    userId: string,
    since: Date | null,
  ): Promise<number> {
    const query = this.dataSource
      .getRepository(Conversation)
      .createQueryBuilder('conversation')
      .where('conversation.landlordId = :userId', { userId });

    if (since) {
      query.andWhere('conversation.createdAt >= :since', { since });
    }

    return query.getCount();
  }

  private countLandlordBookings(
    userId: string,
    since: Date | null,
    status?: BookingStatus,
  ): Promise<number> {
    const query = this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .innerJoin(Listing, 'listing', 'listing.id = booking.listingId')
      .where('listing.ownerId = :userId', { userId });

    if (since) {
      query.andWhere('booking.createdAt >= :since', { since });
    }

    if (status) {
      query.andWhere('booking.status = :status', { status });
    }

    return query.getCount();
  }

  async addFavorite(userId: string, id: string) {
    const listing = await this.listingRepository.findOneBy({ id });

    this.assertActiveListing(listing);

    await this.favoriteRepository
      .createQueryBuilder()
      .insert()
      .into(Favorite)
      .values({ userId, listingId: id })
      .orIgnore()
      .execute();

    const favorite = await this.favoriteRepository.findOneByOrFail({
      userId,
      listingId: id,
    });

    return {
      listingId: id,
      isFavorite: true,
      createdAt: favorite.createdAt,
    };
  }

  async reportListing(userId: string, id: string, dto: ReportListingDto) {
    const listing = await this.listingRepository.findOneBy({ id });

    this.assertActiveListing(listing);

    if (listing.ownerId === userId) {
      throw new BadRequestException('Bạn không thể báo cáo tin đăng của mình');
    }

    const reportRepository = this.dataSource.getRepository(ListingReport);
    const existingReport = await reportRepository.existsBy({
      listingId: id,
      reporterId: userId,
    });

    if (existingReport) {
      throw new ConflictException('Bạn đã báo cáo tin đăng này trước đó');
    }

    try {
      await reportRepository.save(
        reportRepository.create({
          listingId: id,
          reporterId: userId,
          reason: dto.reason,
          note: dto.note?.trim() || null,
        }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code ===
          POSTGRES_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Bạn đã báo cáo tin đăng này trước đó');
      }

      throw error;
    }

    return { listingId: id, reported: true };
  }

  async removeFavorite(userId: string, id: string): Promise<void> {
    await this.favoriteRepository.delete({ userId, listingId: id });
  }

  async updateListingStatus(
    userId: string,
    id: string,
    status: ListingStatus.ACTIVE | ListingStatus.HIDDEN,
  ) {
    const listing = await this.listingRepository.findOneBy({
      id,
      ownerId: userId,
    });

    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng của bạn');
    }

    const canHide =
      status === ListingStatus.HIDDEN &&
      (listing.status === ListingStatus.ACTIVE ||
        listing.status === ListingStatus.PAUSED);
    const canShow =
      status === ListingStatus.ACTIVE &&
      (listing.status === ListingStatus.HIDDEN ||
        listing.status === ListingStatus.PAUSED);
    const isUnchanged = listing.status === status;

    if (!canHide && !canShow && !isUnchanged) {
      throw new BadRequestException(
        'Chỉ tin đang hiển thị hoặc đã ẩn mới có thể đổi trạng thái nhanh',
      );
    }

    listing.status = status;
    const updatedListing = await this.listingRepository.save(listing);

    return this.toLandlordListing(updatedListing);
  }

  async updateRentalStatus(userId: string, id: string, rented: boolean) {
    const listing = await this.listingRepository.findOneBy({
      id,
      ownerId: userId,
    });

    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng của bạn');
    }

    if (rented) {
      if (listing.status === ListingStatus.RENTED) {
        throw new ConflictException('Tin này đã được đánh dấu là đã cho thuê');
      }

      if (
        listing.status !== ListingStatus.ACTIVE &&
        listing.status !== ListingStatus.PAUSED
      ) {
        throw new BadRequestException(
          'Chỉ tin đang hiển thị mới có thể đánh dấu đã cho thuê',
        );
      }
    } else if (listing.status !== ListingStatus.RENTED) {
      throw new ConflictException('Tin này chưa được đánh dấu là đã cho thuê');
    }

    await this.dataSource.transaction(async (manager) => {
      listing.status = rented ? ListingStatus.RENTED : ListingStatus.ACTIVE;
      await manager.save(listing);

      if (!rented) return;

      const openBookings = await manager.find(Booking, {
        select: { id: true },
        where: {
          listingId: id,
          status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
        },
      });

      if (openBookings.length === 0) return;

      const now = new Date();

      await manager.update(
        Booking,
        { id: In(openBookings.map((booking) => booking.id)) },
        { status: BookingStatus.EXPIRED, expiredAt: now, expiresAt: null },
      );
      await manager.insert(
        BookingEvent,
        openBookings.map((booking) => ({
          bookingId: booking.id,
          eventType: BookingStatus.EXPIRED,
          actor: 'system',
          metadata: { reason: 'Phòng đã được cho thuê' },
        })),
      );
    });

    return this.toLandlordListing(listing);
  }

  async updateListing(
    userId: string,
    id: string,
    dto: CreateListingDto,
  ): Promise<Listing> {
    const province = await this.provinceRepository.findOneBy({
      code: dto.provinceCode,
    });

    if (!province) {
      throw new NotFoundException('Không tìm thấy tỉnh/thành phố');
    }

    const ward = await this.wardRepository.findOneBy({ code: dto.wardCode });

    if (!ward) {
      throw new NotFoundException('Không tìm thấy phường/xã');
    }

    if (ward.provinceCode !== province.code) {
      throw new BadRequestException(
        'Phường/xã không thuộc tỉnh/thành phố đã chọn',
      );
    }

    await this.assertImagesValid(dto.images?.map((image) => image.key));
    const existingVideoKey = (
      await this.listingRepository.findOne({
        where: { id, ownerId: userId },
        select: { id: true, videoKey: true },
      })
    )?.videoKey;

    await this.assertVideoValid(dto.videoKey, existingVideoKey);

    const amenityIds = [...new Set(dto.amenityIds ?? [])];
    const amenities = amenityIds.length
      ? await this.amenityRepository.findBy({ id: In(amenityIds) })
      : [];

    if (amenities.length !== amenityIds.length) {
      throw new NotFoundException('Một hoặc nhiều tiện ích không tồn tại');
    }

    if (amenities.some((amenity) => !amenity.isActive)) {
      throw new BadRequestException(
        'Một hoặc nhiều tiện ích đã bị vô hiệu hóa',
      );
    }

    const coverCount = dto.images?.filter((image) => image.isCover).length ?? 0;

    if (coverCount > 1) {
      throw new BadRequestException('Tin đăng chỉ được có một ảnh bìa');
    }

    const nextImageKeys = new Set(dto.images?.map((image) => image.key) ?? []);
    const { updatedListing, removedImageKeys, removedVideoKey } =
      await this.dataSource.transaction(async (manager) => {
        const listing = await manager.findOne(Listing, {
          where: { id, ownerId: userId },
          relations: { images: true },
        });

        if (!listing) {
          throw new NotFoundException('Không tìm thấy tin đăng của bạn');
        }

        const removedImageKeys = listing.images
          .map((image) => this.storageService.getObjectKey(image.url))
          .filter((key): key is string => key !== null)
          .filter((key) => !nextImageKeys.has(key));

        const removedVideoKey =
          listing.videoKey && listing.videoKey !== (dto.videoKey ?? null)
            ? listing.videoKey
            : null;

        const isKeyFieldChanged =
          Number(listing.price) !== dto.price ||
          Number(listing.area) !== dto.area;
        const nextStatus =
          listing.status === ListingStatus.PENDING ||
          listing.status === ListingStatus.REJECTED ||
          isKeyFieldChanged
            ? ListingStatus.PENDING
            : listing.status;

        Object.assign(listing, {
          title: dto.title,
          description: dto.description ?? null,
          roomType: dto.roomType,
          price: String(dto.price),
          area: String(dto.area),
          maxOccupants: dto.maxOccupants,
          electricPrice:
            dto.electricPrice === undefined ? null : String(dto.electricPrice),
          waterPrice:
            dto.waterPrice === undefined ? null : String(dto.waterPrice),
          deposit: dto.deposit === undefined ? null : String(dto.deposit),
          streetAddress: dto.streetAddress,
          provinceCode: province.code,
          wardCode: ward.code,
          fullAddress: `${dto.streetAddress}, ${ward.fullName}, ${province.fullName}`,
          location: {
            type: 'Point',
            coordinates: [dto.longitude, dto.latitude],
          },
          status: nextStatus,
          videoKey: dto.videoKey ?? null,
          viewingSchedule: dto.viewingSchedule
            ? { ...dto.viewingSchedule }
            : null,
        });

        await manager.save(Listing, listing);
        await manager.delete(ListingImage, { listingId: id });
        await manager.delete(ListingAmenity, { listingId: id });

        if (dto.images?.length) {
          const hasCover = coverCount === 1;
          const images = dto.images.map((image, index) =>
            manager.create(ListingImage, {
              listingId: id,
              url: image.key,
              isCover: hasCover ? image.isCover === true : index === 0,
              sortOrder: index,
            }),
          );

          await manager.save(ListingImage, images);
        }

        if (amenities.length) {
          const listingAmenities = amenities.map((amenity) =>
            manager.create(ListingAmenity, {
              listingId: id,
              amenityId: amenity.id,
            }),
          );

          await manager.save(ListingAmenity, listingAmenities);
        }

        const updatedListing = await manager.findOne(Listing, {
          where: { id },
          relations: { images: true, listingAmenities: true },
        });

        if (!updatedListing) {
          throw new NotFoundException('Không tìm thấy tin đăng vừa cập nhật');
        }

        return { updatedListing, removedImageKeys, removedVideoKey };
      });

    await this.deleteImagesFromStorage([
      ...removedImageKeys,
      ...(removedVideoKey ? [removedVideoKey] : []),
    ]);

    return updatedListing;
  }

  async deleteListing(userId: string, id: string) {
    const listing = await this.listingRepository.findOneBy({
      id,
      ownerId: userId,
    });

    if (!listing) {
      throw new NotFoundException('Không tìm thấy tin đăng của bạn');
    }

    const activeBookingCount = await this.dataSource
      .getRepository(Booking)
      .count({
        where: { listingId: id, status: In(ACTIVE_BOOKING_STATUSES) },
      });

    if (activeBookingCount > 0) {
      listing.status = ListingStatus.PAUSED;
      await this.listingRepository.save(listing);

      return { deleted: false, status: ListingStatus.PAUSED };
    }

    await this.listingRepository.softRemove(listing);

    return { deleted: true, status: null };
  }

  async getAmenities(): Promise<Amenity[]> {
    return this.amenityRepository.find({
      where: { isActive: true },
      order: { group: 'ASC', id: 'ASC' },
    });
  }

  async getListingsByIds(userId: string, roleId: UserRoleType, ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    const query = this.createDetailBaseQuery().where(
      'listing.id IN (:...ids)',
      {
        ids: uniqueIds,
      },
    );

    if (roleId !== UserRoleType.ADMIN) {
      query.andWhere(
        '(listing.status = :activeStatus OR listing.ownerId = :userId)',
        {
          activeStatus: ListingStatus.ACTIVE,
          userId,
        },
      );
    }

    const [listings, favorites, holds] = await Promise.all([
      query.getMany(),
      this.favoriteRepository.find({
        where: { userId, listingId: In(uniqueIds) },
        select: { listingId: true },
      }),
      findActiveHolds(this.dataSource, uniqueIds),
    ]);
    const favoriteIds = new Set(favorites.map((item) => item.listingId));
    const listingsById = new Map(
      listings.map((listing) => [listing.id, listing]),
    );

    return uniqueIds.flatMap((id) => {
      const listing = listingsById.get(id);

      return listing
        ? [
            this.toListingDetail(
              listing,
              favoriteIds.has(listing.id),
              holds.get(listing.id),
              listing.ownerId === userId || roleId === UserRoleType.ADMIN,
            ),
          ]
        : [];
    });
  }

  private createDetailQuery(id: string, withDeleted = false) {
    const query = this.createDetailBaseQuery().where('listing.id = :id', {
      id,
    });

    return withDeleted ? query.withDeleted() : query;
  }

  private createDetailBaseQuery() {
    return this.listingRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'image')
      .leftJoinAndSelect('listing.listingAmenities', 'listingAmenity')
      .leftJoinAndSelect('listingAmenity.amenity', 'amenity')
      .leftJoinAndSelect('listing.province', 'province')
      .leftJoinAndSelect('listing.ward', 'ward')
      .leftJoin('listing.owner', 'owner')
      .addSelect([
        'owner.id',
        'owner.fullName',
        'owner.avatarUrl',
        'owner.bio',
        'owner.isVerified',
      ])
      .orderBy('image.sortOrder', 'ASC')
      .addOrderBy('amenity.group', 'ASC')
      .addOrderBy('amenity.id', 'ASC');
  }

  private async findMyActiveBooking(userId: string, listingId: string) {
    const booking = await this.dataSource.getRepository(Booking).findOne({
      select: { id: true, status: true, startTime: true, expiresAt: true },
      where: {
        listingId,
        userId,
        status: In(ACTIVE_BOOKING_STATUSES),
      },
      order: { createdAt: 'DESC' },
    });

    return booking
      ? {
          id: booking.id,
          status: booking.status,
          startTime: booking.startTime,
          expiresAt: booking.expiresAt,
        }
      : null;
  }

  private async hasListingHistory(userId: string, listingId: string) {
    const [hasBooking, hasConversation] = await Promise.all([
      this.dataSource
        .getRepository(Booking)
        .exists({ where: { listingId, userId } }),
      this.dataSource
        .getRepository(Conversation)
        .exists({ where: { listingId, studentId: userId } }),
    ]);

    return hasBooking || hasConversation;
  }

  private assertCanAccessListing(
    listing: Listing | null,
    userId: string,
    roleId: UserRoleType,
  ): asserts listing is Listing {
    const canAccess =
      listing &&
      (listing.status === ListingStatus.ACTIVE ||
        listing.ownerId === userId ||
        roleId === UserRoleType.ADMIN);

    if (!canAccess) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
  }

  private assertActiveListing(
    listing: Listing | null,
  ): asserts listing is Listing {
    if (!listing || listing.status !== ListingStatus.ACTIVE) {
      throw new NotFoundException('Không tìm thấy tin đăng');
    }
  }

  private toListingDetail(
    listing: Listing,
    isFavorite: boolean,
    hold: ListingHoldInfo | undefined,
    canSeeStats: boolean,
    myBooking: {
      id: string;
      status: BookingStatus;
      startTime: Date;
      expiresAt: Date | null;
    } | null = null,
  ) {
    const images = [...(listing.images ?? [])].sort(
      (first, second) => first.sortOrder - second.sortOrder,
    );
    const amenities = (listing.listingAmenities ?? [])
      .filter((item) => item.amenity)
      .map((item) => ({
        id: item.amenity.id,
        name: item.amenity.name,
        group: item.amenity.group,
      }));

    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      roomType: listing.roomType,
      price: Number(listing.price),
      area: Number(listing.area),
      maxOccupants: listing.maxOccupants,
      electricPrice: listing.electricPrice
        ? Number(listing.electricPrice)
        : null,
      waterPrice: listing.waterPrice ? Number(listing.waterPrice) : null,
      deposit: listing.deposit ? Number(listing.deposit) : null,
      address: {
        streetAddress: listing.streetAddress,
        fullAddress: listing.fullAddress,
        provinceCode: listing.provinceCode,
        provinceName: listing.province?.fullName ?? null,
        wardCode: listing.wardCode,
        wardName: listing.ward?.fullName ?? null,
      },
      location: {
        latitude: listing.location.coordinates[1],
        longitude: listing.location.coordinates[0],
      },
      images: images.map((image) => ({
        id: image.id,
        url: this.storageService.getPublicUrl(image.url),
        isCover: image.isCover,
        sortOrder: image.sortOrder,
      })),
      videoUrl: listing.videoKey
        ? this.storageService.getPublicUrl(listing.videoKey)
        : null,
      amenities,
      landlord: {
        id: listing.owner.id,
        fullName: listing.owner.fullName,
        avatarUrl: listing.owner.avatarUrl
          ? this.storageService.getPublicUrl(listing.owner.avatarUrl)
          : null,
        bio: listing.owner.bio,
        isVerified: listing.owner.isVerified,
      },
      status: listing.status,
      viewingSchedule: listing.viewingSchedule,
      averageRating: null,
      viewCount: canSeeStats ? listing.viewCount : null,
      availability: this.getAvailability(listing, hold),
      hold: hold
        ? { expiresAt: hold.expiresAt, daysLeft: hold.daysLeft }
        : null,
      isFavorite,
      myBooking,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
    };
  }

  private async deleteImagesFromStorage(imageKeys: string[]): Promise<void> {
    await Promise.all(
      imageKeys.map((key) => this.storageService.deleteFile(key)),
    );
  }

  private async loadEngagementCounts(
    listingIds: string[],
  ): Promise<Map<string, { saveCount: number; contactCount: number }>> {
    const counts = new Map<
      string,
      { saveCount: number; contactCount: number }
    >();

    if (listingIds.length === 0) return counts;

    const [saves, conversations, bookings] = await Promise.all([
      this.favoriteRepository
        .createQueryBuilder('favorite')
        .select('favorite.listingId', 'listingId')
        .addSelect('COUNT(*)', 'total')
        .where('favorite.listingId IN (:...listingIds)', { listingIds })
        .groupBy('favorite.listingId')
        .getRawMany<{ listingId: string; total: string }>(),
      this.dataSource
        .getRepository(Conversation)
        .createQueryBuilder('conversation')
        .select('conversation.listingId', 'listingId')
        .addSelect('COUNT(*)', 'total')
        .where('conversation.listingId IN (:...listingIds)', { listingIds })
        .groupBy('conversation.listingId')
        .getRawMany<{ listingId: string; total: string }>(),
      this.dataSource
        .getRepository(Booking)
        .createQueryBuilder('booking')
        .select('booking.listingId', 'listingId')
        .addSelect('COUNT(*)', 'total')
        .where('booking.listingId IN (:...listingIds)', { listingIds })
        .groupBy('booking.listingId')
        .getRawMany<{ listingId: string; total: string }>(),
    ]);

    const entryFor = (listingId: string) => {
      const entry = counts.get(listingId) ?? { saveCount: 0, contactCount: 0 };

      counts.set(listingId, entry);

      return entry;
    };

    saves.forEach((row) => {
      entryFor(row.listingId).saveCount = Number(row.total);
    });
    conversations.forEach((row) => {
      entryFor(row.listingId).contactCount += Number(row.total);
    });
    bookings.forEach((row) => {
      entryFor(row.listingId).contactCount += Number(row.total);
    });

    return counts;
  }

  private toLandlordListing(
    listing: Listing,
    engagement?: { saveCount: number; contactCount: number },
  ) {
    const images = [...(listing.images ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const coverImage = images.find((image) => image.isCover) ?? images[0];
    const imageKeys = images
      .map((image) => this.storageService.getObjectKey(image.url))
      .filter((key): key is string => key !== null);
    const coverImageKey = coverImage
      ? this.storageService.getObjectKey(coverImage.url)
      : null;

    return {
      id: listing.id,
      title: listing.title,
      price: Number(listing.price),
      area: Number(listing.area),
      address: listing.fullAddress,
      imageUrl: coverImage
        ? this.storageService.getPublicUrl(coverImage.url)
        : undefined,
      imageKey: coverImageKey ?? undefined,
      imageUrls: images.map((image) =>
        this.storageService.getPublicUrl(image.url),
      ),
      imageKeys,
      videoKey: listing.videoKey ?? undefined,
      videoUrl: listing.videoKey
        ? this.storageService.getPublicUrl(listing.videoKey)
        : undefined,
      status: listing.deletedAt ? 'deleted' : listing.status,
      isFeatured: false,
      viewCount: listing.viewCount,
      contactCount: engagement?.contactCount ?? 0,
      saveCount: engagement?.saveCount ?? 0,
      holdingStatus: false,
      roomType: listing.roomType,
      maxOccupants: listing.maxOccupants,
      description: listing.description ?? undefined,
      electricPrice: listing.electricPrice
        ? Number(listing.electricPrice)
        : undefined,
      waterPrice: listing.waterPrice ? Number(listing.waterPrice) : undefined,
      deposit: listing.deposit ? Number(listing.deposit) : undefined,
      streetAddress: listing.streetAddress,
      provinceCode: listing.provinceCode,
      provinceName: listing.province?.fullName,
      wardCode: listing.wardCode,
      wardName: listing.ward?.fullName,
      latitude: listing.location.coordinates[1],
      longitude: listing.location.coordinates[0],
      amenityIds: listing.listingAmenities?.map((item) => item.amenityId) ?? [],
      viewingSchedule: listing.viewingSchedule ?? undefined,
    };
  }

  private getAvailability(listing: Listing, hold?: ListingHoldInfo) {
    if (listing.status === ListingStatus.RENTED) return 'rented';

    if (listing.status === ListingStatus.PAUSED) return 'paused';

    return hold ? 'holding' : 'available';
  }

  private async assertImagesValid(keys: string[] | undefined): Promise<void> {
    const newKeys = (keys ?? []).filter((key) => key.startsWith('listings/'));

    await Promise.all(
      newKeys.map((key) => this.storageService.assertValidImageObject(key)),
    );
  }

  private async assertVideoValid(
    key: string | null | undefined,
    currentKey?: string | null,
  ): Promise<void> {
    if (!key || key === currentKey) return;

    await this.storageService.assertValidVideoObject(key);
  }

  private async assertLandlordVerified(userId: string): Promise<void> {
    const landlord = await this.dataSource.getRepository(User).findOne({
      select: { id: true, landlordVerifiedAt: true },
      where: { id: userId },
    });

    if (!landlord?.landlordVerifiedAt) {
      throw new ForbiddenException({
        error: 'LANDLORD_NOT_VERIFIED',
        message:
          'Tài khoản đang ở trạng thái "Chờ xác minh". Vui lòng hoàn thiện thông tin xác minh trước khi đăng tin',
      });
    }
  }
}

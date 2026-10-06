import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Listing, ListingStatus } from '@modules/listings/entities';
import {
  BookingListQueryDto,
  BookingSlotsQueryDto,
  CancelBookingDto,
  CreateBookingDto,
} from '../dto';
import { Booking, BookingEvent, BookingStatus } from '../entities';
import {
  doTimeRangesOverlap,
  isCancellationReasonRequired,
} from './booking-policy';

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.HOLDING,
];
const SLOT_TIMES = [
  '08:00',
  '09:00',
  '10:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '18:00',
  '19:00',
  '20:00',
];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DEFAULT_DEPOSIT_AMOUNT = 2_500_000;
const SLOT_DURATION_MINUTES = 60;

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(BookingEvent)
    private readonly eventRepository: Repository<BookingEvent>,
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async getSlots(query: BookingSlotsQueryDto) {
    const listing = await this.listingRepository.findOne({
      where: { id: query.listingId },
    });

    if (!listing) {
      throw new NotFoundException('Không tìm thấy phòng trọ');
    }

    const dayStart = new Date(`${query.date}T00:00:00+07:00`);
    const dayEnd = new Date(`${query.date}T23:59:59.999+07:00`);

    if (Number.isNaN(dayStart.getTime())) {
      throw new BadRequestException('Ngày xem phòng không hợp lệ');
    }

    const bookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .select(['booking.startTime', 'booking.endTime'])
      .where('booking.listing_id = :listingId', { listingId: listing.id })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: ACTIVE_BOOKING_STATUSES,
      })
      .andWhere(
        'booking.start_time < :dayEnd AND booking.end_time > :dayStart',
        {
          dayStart,
          dayEnd,
        },
      )
      .getMany();

    const schedule = listing.viewingSchedule as Record<
      string,
      Record<string, boolean>
    > | null;
    const dayKey = DAY_KEYS[new Date(`${query.date}T12:00:00+07:00`).getDay()];
    const now = new Date();

    return SLOT_TIMES.map((time) => {
      const startTime = new Date(`${query.date}T${time}:00+07:00`);
      const endTime = new Date(
        startTime.getTime() + SLOT_DURATION_MINUTES * 60_000,
      );
      const period = this.getSlotPeriod(time);
      const isEnabledBySchedule = schedule?.[dayKey]?.[period] ?? true;
      const hasOverlap = bookings.some((booking) =>
        doTimeRangesOverlap(
          booking.startTime,
          booking.endTime,
          startTime,
          endTime,
        ),
      );

      return {
        time,
        startTime: startTime.toISOString(),
        available: isEnabledBySchedule && !hasOverlap && startTime > now,
      };
    });
  }

  async create(userId: string, dto: CreateBookingDto) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const listing = await queryRunner.manager.findOne(Listing, {
        where: { id: dto.listingId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!listing || listing.status !== ListingStatus.ACTIVE) {
        throw new NotFoundException(
          'Phòng trọ không tồn tại hoặc chưa sẵn sàng đặt lịch',
        );
      }

      const startTime = new Date(dto.startTime);
      const endTime = new Date(
        startTime.getTime() + SLOT_DURATION_MINUTES * 60_000,
      );

      if (Number.isNaN(startTime.getTime()) || startTime <= new Date()) {
        throw new BadRequestException(
          'Thời gian xem phòng phải ở trong tương lai',
        );
      }

      const overlappingCount = await queryRunner.manager
        .createQueryBuilder(Booking, 'booking')
        .where('booking.listing_id = :listingId', { listingId: listing.id })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: ACTIVE_BOOKING_STATUSES,
        })
        .andWhere(
          'booking.start_time < :endTime AND booking.end_time > :startTime',
          {
            startTime,
            endTime,
          },
        )
        .getCount();

      if (overlappingCount > 0) {
        throw new ConflictException({
          error: 'SLOT_TAKEN',
          message: 'Khung giờ vừa có người đặt, vui lòng chọn khung giờ khác',
        });
      }

      const pendingDuration = this.configService.get<number>(
        'HOLD_DURATION_MINUTES',
        15,
      );
      const expiresAt = new Date(Date.now() + pendingDuration * 60_000);
      const booking = queryRunner.manager.create(Booking, {
        code: this.createBookingCode(),
        listingId: listing.id,
        userId,
        phone: dto.phone,
        startTime,
        endTime,
        status: BookingStatus.PENDING,
        expiresAt,
        note: dto.note?.trim() || null,
      });
      const savedBooking = await queryRunner.manager.save(booking);

      await queryRunner.manager.save(
        queryRunner.manager.create(BookingEvent, {
          bookingId: savedBooking.id,
          eventType: 'created',
          actor: 'student',
          metadata: null,
        }),
      );

      await queryRunner.commitTransaction();

      return this.findOne(userId, savedBooking.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(userId: string, query: BookingListQueryDto) {
    const builder = this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.listing', 'listing')
      .leftJoinAndSelect('listing.images', 'images')
      .where('booking.user_id = :userId', { userId })
      .orderBy('booking.created_at', 'DESC');

    if (query.status) {
      builder.andWhere('booking.status = :status', { status: query.status });
    }

    if (query.from) {
      builder.andWhere('booking.start_time >= :from', {
        from: new Date(query.from),
      });
    }

    if (query.to) {
      builder.andWhere('booking.start_time <= :to', { to: new Date(query.to) });
    }

    const [items, total] = await builder
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      items: items.map((booking) => this.toResponse(booking)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findOne(userId: string, id: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: { listing: { images: true }, events: true },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy lịch hẹn');
    }

    if (booking.userId !== userId && booking.listing.ownerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem lịch hẹn này');
    }

    return this.toResponse(booking);
  }

  async confirm(landlordId: string, id: string) {
    const booking = await this.getBookingWithListing(id);

    if (booking.listing.ownerId !== landlordId) {
      throw new ForbiddenException('Bạn không có quyền xác nhận lịch hẹn này');
    }

    this.assertStatus(
      booking,
      [BookingStatus.PENDING, BookingStatus.HOLDING],
      'Chỉ có thể xác nhận yêu cầu đang chờ hoặc đang giữ chỗ',
    );

    booking.status = BookingStatus.CONFIRMED;
    booking.confirmedAt = new Date();
    booking.expiresAt = null;

    await this.bookingRepository.save(booking);
    await this.addEvent(booking.id, 'confirmed', 'landlord');

    return this.findOne(landlordId, booking.id);
  }

  async hold(userId: string, id: string) {
    const booking = await this.getBookingWithListing(id);

    if (booking.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền giữ chỗ cho lịch hẹn này',
      );
    }

    this.assertStatus(
      booking,
      [BookingStatus.PENDING],
      'Chỉ yêu cầu đang chờ mới có thể giữ chỗ',
    );

    const holdingDays = this.configService.get<number>('HOLDING_DAYS', 7);

    booking.status = BookingStatus.HOLDING;
    booking.expiresAt = new Date(Date.now() + holdingDays * 24 * 60 * 60_000);
    booking.depositAmount =
      booking.listing.deposit ?? String(DEFAULT_DEPOSIT_AMOUNT);

    await this.bookingRepository.save(booking);
    await this.addEvent(booking.id, 'holding', 'student');

    return this.findOne(userId, booking.id);
  }

  async cancel(userId: string, id: string, dto: CancelBookingDto) {
    const booking = await this.getBookingWithListing(id);

    if (booking.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền hủy lịch hẹn này');
    }

    this.assertStatus(
      booking,
      [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.HOLDING],
      'Lịch hẹn đã kết thúc nên không thể hủy',
    );

    const cancelFreeHours = this.configService.get<number>(
      'CANCEL_FREE_HOURS',
      24,
    );
    const reason = dto.reason?.trim();

    if (
      isCancellationReasonRequired(
        booking.startTime,
        new Date(),
        cancelFreeHours,
      ) &&
      !reason
    ) {
      throw new BadRequestException(
        'Vui lòng nhập lý do khi hủy lịch hẹn trước giờ xem dưới 24 giờ',
      );
    }

    booking.status = BookingStatus.CANCELLED;
    booking.cancelReason = reason || null;
    booking.cancelledAt = new Date();
    booking.expiresAt = null;

    await this.bookingRepository.save(booking);
    await this.addEvent(
      booking.id,
      'cancelled',
      'student',
      reason ? { reason } : null,
    );

    return this.findOne(userId, booking.id);
  }

  private async getBookingWithListing(id: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: { listing: { images: true } },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy lịch hẹn');
    }

    return booking;
  }

  private assertStatus(
    booking: Booking,
    statuses: BookingStatus[],
    message: string,
  ) {
    if (!statuses.includes(booking.status)) {
      throw new ConflictException(message);
    }
  }

  private async addEvent(
    bookingId: string,
    eventType: string,
    actor: string,
    metadata: Record<string, unknown> | null = null,
  ) {
    await this.eventRepository.save(
      this.eventRepository.create({ bookingId, eventType, actor, metadata }),
    );
  }

  private getSlotPeriod(time: string) {
    const hour = Number(time.slice(0, 2));

    if (hour < 12) return 'morning';

    if (hour < 18) return 'afternoon';

    return 'evening';
  }

  private createBookingCode() {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(now)
      .replaceAll('-', '');
    const suffix = `${now.getTime()}`.slice(-6);

    return `BK-${date}-${suffix}`;
  }

  private toResponse(booking: Booking) {
    const images = booking.listing?.images ?? [];
    const coverImage = images.find((image) => image.isCover) ?? images[0];
    const events = [...(booking.events ?? [])].sort(
      (first, second) => first.createdAt.getTime() - second.createdAt.getTime(),
    );

    return {
      id: booking.id,
      code: booking.code,
      phone: booking.phone,
      note: booking.note,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
      expiresAt: booking.expiresAt,
      cancelReason: booking.cancelReason,
      depositAmount: booking.depositAmount
        ? Number(booking.depositAmount)
        : null,
      confirmedAt: booking.confirmedAt,
      expiredAt: booking.expiredAt,
      cancelledAt: booking.cancelledAt,
      createdAt: booking.createdAt,
      listing: booking.listing
        ? {
            id: booking.listing.id,
            title: booking.listing.title,
            price: Number(booking.listing.price),
            deposit: booking.listing.deposit
              ? Number(booking.listing.deposit)
              : null,
            address: booking.listing.fullAddress,
            imageUrl: coverImage?.url ?? null,
          }
        : null,
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        actor: event.actor,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
    };
  }
}

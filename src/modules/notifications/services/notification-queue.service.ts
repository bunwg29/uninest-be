import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { Between, In, LessThanOrEqual, Repository } from 'typeorm';
import {
  ADMIN_EVENTS,
  type ReportWarningIssuedPayload,
} from '@modules/admin/constants';
import { ReportEntityType } from '@modules/admin/entities';
import {
  BOOKING_EVENTS,
  type BookingStatusChangedPayload,
} from '@modules/booking/constants';
import { Booking, BookingStatus } from '@modules/booking/entities';
import { CHAT_EVENTS } from '@modules/chat/constants';
import type { MessageCreatedEvent } from '@modules/chat/services/chat.service';
import {
  LISTING_EVENTS,
  type ListingReviewedPayload,
} from '@modules/listings/constants';
import { ListingStatus } from '@modules/listings/entities';
import {
  PAYMENT_EVENTS,
  type PaymentCompletedPayload,
} from '@modules/payment/constants';
import {
  Notification,
  NotificationDelivery,
  NotificationDeliveryStatus,
  NotificationPreference,
  NotificationType,
  PushDevice,
} from '../entities';

interface NotificationJob {
  userId: string;
  eventKey: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, string>;
}

@Injectable()
export class NotificationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private readonly queue: Queue<NotificationJob>;
  private readonly connection: IORedis;
  private readonly queueConnection: IORedis;
  private worker?: Worker<NotificationJob>;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationDelivery)
    private readonly deliveries: Repository<NotificationDelivery>,
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(PushDevice)
    private readonly devices: Repository<PushDevice>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
  ) {
    this.connection = new IORedis(
      this.config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      {
        maxRetriesPerRequest: null,
      },
    );

    this.queueConnection = new IORedis(
      this.config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      { maxRetriesPerRequest: 1, enableOfflineQueue: false },
    );

    this.queue = new Queue<NotificationJob>('notifications', {
      connection: this.queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      },
    });
    this.connection.on('error', (error) =>
      this.logger.error('Redis connection error', error.stack),
    );
    this.queueConnection.on('error', (error) =>
      this.logger.error('Redis producer connection error', error.stack),
    );
    this.queue.on('error', (error) =>
      this.logger.error('Notification queue error', error.stack),
    );
  }

  onModuleInit(): void {
    this.worker = new Worker<NotificationJob>(
      'notifications',
      async (job) => this.process(job),
      {
        connection: this.connection,
        concurrency: 8,
      },
    );
    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Notification job ${job?.id ?? 'unknown'} failed`,
        error.stack,
      );
    });
    this.worker.on('error', (error) =>
      this.logger.error('Notification worker error', error.stack),
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection.status !== 'ready') {
      this.connection.disconnect();
      this.queueConnection.disconnect();
      await this.worker?.close(true);

      return;
    }

    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
    await this.queueConnection.quit();
  }

  @OnEvent(CHAT_EVENTS.MESSAGE_CREATED)
  onMessage(event: MessageCreatedEvent): void {
    this.schedule({
      userId: event.recipientId,
      eventKey: `message:${event.message.id}`,
      type: NotificationType.MESSAGE,
      title: 'Bạn có tin nhắn mới',
      body:
        event.message.content?.slice(0, 120) || 'Bạn vừa nhận được tin nhắn',
      payload: {
        screen: 'ChatRoom',
        conversationId: event.message.conversationId,
      },
    });
  }

  @OnEvent(LISTING_EVENTS.REVIEWED)
  onListingReviewed(event: ListingReviewedPayload): void {
    this.schedule({
      userId: event.ownerId,
      eventKey: `listing-reviewed:${event.auditId}`,
      type: NotificationType.SYSTEM,
      title:
        event.status === ListingStatus.ACTIVE
          ? 'Tin đăng đã được duyệt'
          : 'Tin đăng bị từ chối',
      body:
        event.status === ListingStatus.ACTIVE
          ? 'Tin đăng của bạn đã được duyệt và đang hiển thị.'
          : `Tin đăng của bạn chưa được duyệt. Lý do: ${event.reason ?? 'Không có lý do'}`,
      payload: { screen: 'ListingDetail', listingId: event.listingId },
    });
  }

  @OnEvent(ADMIN_EVENTS.REPORT_WARNING_ISSUED)
  onReportWarning(event: ReportWarningIssuedPayload): void {
    const payload: Record<string, string> = {};

    if (event.entityType === ReportEntityType.LISTING) {
      payload.screen = 'ListingDetail';
      payload.listingId = event.entityId;
    } else if (
      event.entityType === ReportEntityType.FORUM_POST ||
      (event.entityType === ReportEntityType.FORUM_COMMENT && event.postId)
    ) {
      payload.screen = 'ForumPostDetail';
      payload.postId = event.postId ?? event.entityId;
    }

    this.schedule({
      userId: event.userId,
      eventKey: `report-warning:${event.auditId}`,
      type: NotificationType.SYSTEM,
      title: 'Cảnh báo từ quản trị viên',
      body: event.reason,
      payload,
    });
  }

  @OnEvent(BOOKING_EVENTS.CREATED)
  onBookingCreated(event: BookingStatusChangedPayload): void {
    this.schedule({
      userId: event.landlordId,
      eventKey: `booking-created:${event.bookingId}`,
      type: NotificationType.BOOKING,
      title: 'Có yêu cầu xem phòng mới',
      body: 'Một sinh viên vừa đặt lịch xem phòng của bạn',
      payload: { screen: 'BookingDetail', bookingId: event.bookingId },
    });
  }

  @OnEvent(BOOKING_EVENTS.STATUS_CHANGED)
  onBookingChanged(event: BookingStatusChangedPayload): void {
    const recipients =
      event.actor === 'student'
        ? [event.landlordId]
        : event.actor === 'landlord'
          ? [event.studentId]
          : [event.studentId, event.landlordId];

    for (const userId of recipients) {
      this.schedule({
        userId,
        eventKey: `booking-status:${event.bookingId}:${event.from}:${event.to}:${userId}`,
        type: NotificationType.BOOKING,
        title: 'Lịch hẹn đã được cập nhật',
        body: `Trạng thái lịch hẹn hiện tại: ${this.bookingStatusLabel(event.to)}`,
        payload: { screen: 'BookingDetail', bookingId: event.bookingId },
      });
    }
  }

  @OnEvent(PAYMENT_EVENTS.COMPLETED)
  onPaymentCompleted(event: PaymentCompletedPayload): void {
    for (const userId of [event.payerId, event.landlordId]) {
      this.schedule({
        userId,
        eventKey: `payment:${event.transactionId}:${userId}`,
        type: NotificationType.PAYMENT,
        title: 'Thanh toán đã được xác nhận',
        body: `${event.purpose === 'deposit' ? 'Tiền cọc' : 'Tiền phòng'} ${event.amount.toLocaleString('vi-VN')} đ đã được thanh toán thành công. Mã giao dịch: ${event.transactionId}`,
        payload: {
          screen: 'BookingDetail',
          bookingId: event.bookingId,
          transactionId: event.transactionId,
        },
      });
    }
  }

  @OnEvent('forum.comment_created')
  onForumComment(event: {
    commentId: string;
    postId: string;
    recipientId: string;
  }): void {
    this.schedule({
      userId: event.recipientId,
      eventKey: `forum-comment:${event.commentId}`,
      type: NotificationType.FORUM,
      title: 'Bài viết của bạn có bình luận mới',
      body: 'Có người vừa bình luận trong bài viết cộng đồng của bạn',
      payload: { screen: 'ForumPostDetail', postId: event.postId },
    });
  }

  @Cron('*/5 * * * *')
  async scheduleReminders(): Promise<void> {
    const now = Date.now();
    const start = new Date(now);
    const end = new Date(now + 60 * 60_000);
    const bookings = await this.bookings.find({
      where: {
        status: In([BookingStatus.CONFIRMED, BookingStatus.HOLDING]),
        startTime: Between(start, end),
      },
      relations: { listing: true },
    });

    for (const booking of bookings) {
      for (const userId of [booking.userId, booking.listing.ownerId]) {
        await this.enqueue({
          userId,
          eventKey: `booking-reminder:${booking.id}:${userId}`,
          type: NotificationType.REMINDER,
          title: 'Sắp đến giờ xem phòng',
          body: 'Lịch xem phòng của bạn sắp bắt đầu',
          payload: { screen: 'BookingDetail', bookingId: booking.id },
        });
      }
    }
  }

  async enqueue(data: NotificationJob): Promise<void> {
    const preferences = await this.preferences.findOneBy({
      userId: data.userId,
    });

    if (!this.isEnabled(data.type, preferences)) {
      return;
    }

    const isNew = await this.notifications.manager.transaction(
      async (manager) => {
        const inserted = await manager
          .getRepository(Notification)
          .createQueryBuilder()
          .insert()
          .values({ ...data, readAt: null })
          .orIgnore()
          .returning('id')
          .execute();

        if (inserted.identifiers.length === 0) {
          return false;
        }

        const notification = await manager
          .getRepository(Notification)
          .findOneByOrFail({
            eventKey: data.eventKey,
          });
        const devices = await manager.getRepository(PushDevice).findBy({
          userId: data.userId,
        });

        if (devices.length > 0) {
          await manager.getRepository(NotificationDelivery).insert(
            devices.map((device) => ({
              notificationId: notification.id,
              token: device.token,
            })),
          );
        }

        return true;
      },
    );

    if (!isNew) {
      return;
    }

    if (this.queueConnection.status !== 'ready') {
      this.logger.warn(
        'Redis is unavailable; delivering notification from PostgreSQL',
      );
      await this.deliverByEventKey(data.eventKey);

      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        this.queue.add('deliver', data, {
          jobId: data.eventKey.replaceAll(':', '-'),
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Redis enqueue timeout')),
            2000,
          );
        }),
      ]);
    } catch (error) {
      this.logger.error(
        'Failed to enqueue notification',
        error instanceof Error ? error.stack : String(error),
      );
      await this.deliverByEventKey(data.eventKey);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private schedule(data: NotificationJob): void {
    void this.enqueue(data).catch((error: unknown) => {
      this.logger.error(
        'Failed to persist notification',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  private async process(job: Job<NotificationJob>): Promise<void> {
    await this.deliverByEventKey(job.data.eventKey);
  }

  private async deliverByEventKey(eventKey: string): Promise<void> {
    const notification = await this.notifications.findOneBy({
      eventKey,
    });

    if (notification) {
      await this.deliverNotification(notification);
    }
  }

  @Cron('*/1 * * * *')
  async recoverDeliveries(): Promise<void> {
    const due = await this.deliveries.find({
      where: {
        status: NotificationDeliveryStatus.PENDING,
        nextAttemptAt: LessThanOrEqual(new Date()),
      },
      order: { nextAttemptAt: 'ASC' },
      take: 100,
    });
    const notificationIds = [
      ...new Set(due.map((item) => item.notificationId)),
    ];

    for (const notificationId of notificationIds) {
      const notification = await this.notifications.findOneBy({
        id: notificationId,
      });

      if (notification) {
        await this.deliverNotification(notification);
      }
    }
  }

  @Cron('*/5 * * * *')
  async checkReceipts(): Promise<void> {
    const due = await this.deliveries.find({
      where: {
        status: NotificationDeliveryStatus.TICKETED,
        nextAttemptAt: LessThanOrEqual(new Date()),
      },
      order: { nextAttemptAt: 'ASC' },
      take: 100,
    });

    if (due.length === 0) {
      return;
    }

    try {
      const response = await this.expoRequest('getReceipts', {
        ids: due.map((item) => item.ticketId),
      });
      const receipts = this.responseData(response);

      if (
        typeof receipts !== 'object' ||
        receipts === null ||
        Array.isArray(receipts)
      ) {
        throw new Error('Expo receipt response has an invalid format');
      }

      for (const delivery of due) {
        const receipt: unknown = delivery.ticketId
          ? (receipts as Record<string, unknown>)[delivery.ticketId]
          : undefined;

        if (!receipt) {
          const expired =
            !delivery.ticketedAt ||
            Date.now() - delivery.ticketedAt.getTime() >= 24 * 60 * 60_000;

          await this.deliveries.update(delivery.id, {
            status: expired
              ? NotificationDeliveryStatus.FAILED
              : NotificationDeliveryStatus.TICKETED,
            nextAttemptAt: new Date(Date.now() + 5 * 60_000),
            lastError: expired ? 'ReceiptUnavailable' : null,
          });
          continue;
        }

        if (this.pushStatus(receipt) === 'ok') {
          await this.deliveries.update(delivery.id, {
            status: NotificationDeliveryStatus.DELIVERED,
            lastError: null,
          });
        } else {
          await this.handlePushError(delivery, this.pushError(receipt));
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to check Expo push receipts',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async deliverNotification(notification: Notification): Promise<void> {
    const due = await this.deliveries.find({
      where: {
        notificationId: notification.id,
        status: NotificationDeliveryStatus.PENDING,
        nextAttemptAt: LessThanOrEqual(new Date()),
      },
      take: 100,
    });

    for (const delivery of due) {
      const claimed = await this.deliveries
        .createQueryBuilder()
        .update()
        .set({ leaseUntil: new Date(Date.now() + 60_000) })
        .where('id = :id AND status = :status AND next_attempt_at <= now()', {
          id: delivery.id,
          status: NotificationDeliveryStatus.PENDING,
        })
        .andWhere('(lease_until IS NULL OR lease_until <= now())')
        .execute();

      if (!claimed.affected) {
        continue;
      }

      try {
        const response = await this.expoRequest('send', {
          to: delivery.token,
          title: notification.title,
          body: notification.body,
          data: notification.payload,
        });
        const ticket = this.responseData(response);

        if (this.pushStatus(ticket) === 'ok') {
          const ticketId = this.pushTicketId(ticket);

          if (!ticketId) {
            throw new Error('Expo push ticket is missing its ID');
          }

          await this.deliveries.update(delivery.id, {
            status: NotificationDeliveryStatus.TICKETED,
            ticketId,
            ticketedAt: new Date(),
            attempts: delivery.attempts + 1,
            nextAttemptAt: new Date(Date.now() + 15 * 60_000),
            leaseUntil: null,
            lastError: null,
          });
        } else {
          await this.handlePushError(delivery, this.pushError(ticket));
        }
      } catch (error) {
        await this.retryDelivery(delivery, 'ExpoRequestFailed');
        this.logger.error(
          'Failed to send Expo push notification',
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async handlePushError(
    delivery: NotificationDelivery,
    errorCode: string,
  ): Promise<void> {
    if (errorCode === 'DeviceNotRegistered') {
      await this.devices.delete({ token: delivery.token });
      await this.deliveries.update(
        {
          token: delivery.token,
          status: In([
            NotificationDeliveryStatus.PENDING,
            NotificationDeliveryStatus.TICKETED,
          ]),
        },
        {
          status: NotificationDeliveryStatus.FAILED,
          leaseUntil: null,
          lastError: errorCode,
        },
      );

      return;
    }

    if (
      errorCode === 'MessageRateExceeded' ||
      errorCode === 'ExpoRequestFailed'
    ) {
      await this.retryDelivery(delivery, errorCode);

      return;
    }

    await this.deliveries.update(delivery.id, {
      status: NotificationDeliveryStatus.FAILED,
      leaseUntil: null,
      lastError: errorCode,
    });
    this.logger.warn(`Expo push delivery failed: ${errorCode}`);
  }

  private async retryDelivery(
    delivery: NotificationDelivery,
    errorCode: string,
  ): Promise<void> {
    const attempts = delivery.attempts + 1;
    const failed = attempts >= 5;

    await this.deliveries.update(delivery.id, {
      status: failed
        ? NotificationDeliveryStatus.FAILED
        : NotificationDeliveryStatus.PENDING,
      attempts,
      ticketId: null,
      ticketedAt: null,
      leaseUntil: null,
      nextAttemptAt: new Date(
        Date.now() + Math.min(60_000 * 2 ** attempts, 30 * 60_000),
      ),
      lastError: errorCode,
    });
  }

  private async expoRequest(path: string, body: object): Promise<unknown> {
    const accessToken = this.config.get<string>('EXPO_PUSH_ACCESS_TOKEN');
    const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Expo push request failed with status ${response.status}`,
      );
    }

    return response.json() as Promise<unknown>;
  }

  private responseData(response: unknown): unknown {
    if (
      typeof response !== 'object' ||
      response === null ||
      !('data' in response)
    ) {
      throw new Error('Expo push response has an invalid format');
    }

    return response.data;
  }

  private pushStatus(value: unknown): string | undefined {
    return typeof value === 'object' &&
      value !== null &&
      'status' in value &&
      typeof value.status === 'string'
      ? value.status
      : undefined;
  }

  private pushTicketId(value: unknown): string | undefined {
    return typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'string'
      ? value.id
      : undefined;
  }

  private pushError(value: unknown): string {
    if (typeof value !== 'object' || value === null || !('details' in value)) {
      return 'UnknownPushError';
    }

    const details: unknown = value.details;

    return typeof details === 'object' &&
      details !== null &&
      'error' in details &&
      typeof details.error === 'string'
      ? details.error.slice(0, 80)
      : 'UnknownPushError';
  }

  private isEnabled(
    type: NotificationType,
    preferences: NotificationPreference | null,
  ): boolean {
    if (!preferences) {
      return true;
    }

    switch (type) {
      case NotificationType.LISTING:
        return preferences.newListings;
      case NotificationType.MESSAGE:
        return preferences.messages;
      case NotificationType.REMINDER:
        return preferences.reminders;
      case NotificationType.SYSTEM:
      case NotificationType.FORUM:
        return preferences.system;
      default:
        return true;
    }
  }

  private bookingStatusLabel(status: BookingStatus): string {
    const labels: Record<BookingStatus, string> = {
      [BookingStatus.PENDING]: 'Chờ xác nhận',
      [BookingStatus.CONFIRMED]: 'Đã xác nhận',
      [BookingStatus.HOLDING]: 'Đang giữ chỗ',
      [BookingStatus.EXPIRED]: 'Đã hết hạn',
      [BookingStatus.CANCELLED]: 'Đã huỷ',
      [BookingStatus.REJECTED]: 'Đã từ chối',
    };

    return labels[status];
  }
}

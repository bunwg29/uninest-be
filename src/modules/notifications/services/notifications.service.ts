import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createPaginatedResult } from '@common/dtos';
import { In, IsNull, Repository } from 'typeorm';
import {
  Notification,
  NotificationPreference,
  NotificationType,
  PushDevice,
} from '../entities';
import {
  NotificationQueryDto,
  RegisterDeviceDto,
  UpdatePreferencesDto,
} from '../dtos';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(PushDevice)
    private readonly devices: Repository<PushDevice>,
  ) {}

  async list(userId: string, query: NotificationQueryDto) {
    const where = {
      userId,
      ...(query.unread ? { readAt: IsNull() } : {}),
      ...(query.type
        ? {
            type:
              query.type === NotificationType.BOOKING
                ? In([NotificationType.BOOKING, NotificationType.REMINDER])
                : query.type,
          }
        : {}),
    };
    const [items, total] = await this.notifications.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return createPaginatedResult(items, total, query.page, query.limit);
  }

  async unreadCount(userId: string) {
    const count = await this.notifications.count({
      where: { userId, readAt: IsNull() },
    });

    return { count };
  }

  async markRead(userId: string, id: string) {
    const result = await this.notifications.update(
      { id, userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    if (!result.affected) {
      const existing = await this.notifications.existsBy({ id, userId });

      if (!existing) {
        throw new NotFoundException('Không tìm thấy thông báo');
      }
    }

    return { id, read: true };
  }

  async markUnread(userId: string, id: string) {
    const result = await this.notifications.update(
      { id, userId },
      { readAt: null },
    );

    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return { id, read: false };
  }

  async markAllRead(userId: string) {
    const result = await this.notifications.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    return { updated: result.affected ?? 0 };
  }

  async getPreferences(userId: string) {
    return (
      (await this.preferences.findOneBy({ userId })) ?? {
        newListings: true,
        messages: true,
        reminders: true,
        system: true,
      }
    );
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.preferences.upsert({ userId, ...dto }, ['userId']);

    return this.getPreferences(userId);
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    await this.devices.upsert({ userId, ...dto }, ['token']);

    return { registered: true };
  }

  async unregisterDevice(userId: string, token: string) {
    await this.devices.delete({ userId, token });

    return { registered: false };
  }
}

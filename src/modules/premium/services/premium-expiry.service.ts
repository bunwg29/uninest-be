import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@modules/users/entities';
import {
  PREMIUM_DEFAULTS,
  PREMIUM_EVENTS,
  type PremiumExpiredPayload,
  type PremiumExpiringPayload,
} from '../constants';

interface ExpiredRow {
  id: string;
  premium_expires_at: Date;
}

@Injectable()
export class PremiumExpiryService {
  private readonly logger = new Logger(PremiumExpiryService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(PREMIUM_DEFAULTS.CRON_EXPRESSION, {
    timeZone: PREMIUM_DEFAULTS.TIME_ZONE,
  })
  async handleDailyCheck(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Premium expiry check skipped because it is running');

      return;
    }

    this.isRunning = true;

    try {
      const downgraded = await this.downgradeExpired();
      const reminded = await this.remindExpiring();

      this.logger.log(
        `Premium expiry check finished: ${downgraded} downgraded, ${reminded} reminded`,
      );
    } catch (error) {
      this.logger.error(
        'Premium expiry check failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  async downgradeExpired(): Promise<number> {
    const result: unknown = await this.userRepository.query(
      `UPDATE users SET is_premium = false
       WHERE is_premium = true AND premium_expires_at <= NOW()
       RETURNING id, premium_expires_at`,
    );
    const rows = this.extractRows(result);

    for (const row of rows) {
      const payload: PremiumExpiredPayload = {
        userId: row.id,
        expiredAt: new Date(row.premium_expires_at),
      };

      this.eventEmitter.emit(PREMIUM_EVENTS.EXPIRED, payload);
    }

    return rows.length;
  }

  async remindExpiring(): Promise<number> {
    const result: unknown = await this.userRepository.query(
      `SELECT id, premium_expires_at FROM users
       WHERE is_premium = true
         AND premium_expires_at > NOW()
         AND premium_expires_at <= NOW() + make_interval(days => $1)`,
      [PREMIUM_DEFAULTS.REMINDER_DAYS],
    );
    const rows = this.extractRows(result);

    for (const row of rows) {
      const payload: PremiumExpiringPayload = {
        userId: row.id,
        expiresAt: new Date(row.premium_expires_at),
      };

      this.eventEmitter.emit(PREMIUM_EVENTS.EXPIRING, payload);
    }

    return rows.length;
  }

  private extractRows(result: unknown): ExpiredRow[] {
    const records = Array.isArray(result) ? (result as unknown[]) : [];
    const rows = Array.isArray(records[0])
      ? (records[0] as unknown[])
      : records;

    return rows.filter(
      (row): row is ExpiredRow =>
        typeof row === 'object' &&
        row !== null &&
        'id' in row &&
        'premium_expires_at' in row,
    );
  }
}

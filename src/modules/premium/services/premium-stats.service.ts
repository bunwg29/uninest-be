import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LISTING_VIEW_SOURCES } from '@modules/listings/constants';
import {
  PREMIUM_DEFAULTS,
  PREMIUM_STATS_PERIOD_DAYS,
  type PremiumStatsPeriod,
} from '../constants';
import { PremiumService } from './premium.service';

interface DailyRow {
  day: string;
  source?: string;
  total: string;
}

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

@Injectable()
export class PremiumStatsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly premiumService: PremiumService,
  ) {}

  async getStats(userId: string, period: PremiumStatsPeriod) {
    await this.premiumService.assertActive(userId);

    const days = PREMIUM_STATS_PERIOD_DAYS[period];
    const dates = this.buildDates(days);
    const since = dates[0];
    const [viewRows, contactRows] = await Promise.all([
      this.queryViews(userId, since),
      this.queryContacts(userId, since),
    ]);
    const viewsByDay = new Map<string, number>();
    const contactsByDay = new Map<string, number>();
    const viewsBySource = new Map<string, number>();

    for (const row of viewRows) {
      const total = Number(row.total);

      viewsByDay.set(row.day, (viewsByDay.get(row.day) ?? 0) + total);
      viewsBySource.set(
        row.source ?? 'other',
        (viewsBySource.get(row.source ?? 'other') ?? 0) + total,
      );
    }

    for (const row of contactRows) {
      contactsByDay.set(
        row.day,
        (contactsByDay.get(row.day) ?? 0) + Number(row.total),
      );
    }

    const daily = dates.map((date) => ({
      date,
      views: viewsByDay.get(date) ?? 0,
      contacts: contactsByDay.get(date) ?? 0,
    }));
    const totalViews = daily.reduce((sum, item) => sum + item.views, 0);
    const totalContacts = daily.reduce((sum, item) => sum + item.contacts, 0);
    const sources = LISTING_VIEW_SOURCES.map((source) => {
      const views = viewsBySource.get(source) ?? 0;

      return {
        source,
        views,
        ratio: totalViews > 0 ? Number((views / totalViews).toFixed(4)) : 0,
      };
    }).sort((first, second) => second.views - first.views);

    return {
      period,
      since,
      totalViews,
      totalContacts,
      conversionRate:
        totalViews > 0 ? Number((totalContacts / totalViews).toFixed(4)) : 0,
      daily,
      sources,
    };
  }

  private buildDates(days: number): string[] {
    const today = this.toLocalDate(new Date());
    const [year, month, day] = today.split('-').map(Number);
    const end = Date.UTC(year, month - 1, day);

    return Array.from({ length: days }, (_, index) =>
      new Date(end - (days - 1 - index) * DAY_MILLISECONDS)
        .toISOString()
        .slice(0, 10),
    );
  }

  private toLocalDate(date: Date): string {
    return date.toLocaleDateString('en-CA', {
      timeZone: PREMIUM_DEFAULTS.TIME_ZONE,
    });
  }

  private async queryViews(userId: string, since: string) {
    const rows: unknown = await this.dataSource.query(
      `SELECT (lv.created_at AT TIME ZONE $3)::date::text AS day,
              lv.source AS source,
              COUNT(*)::text AS total
       FROM listing_views lv
       INNER JOIN listings l ON l.id = lv.listing_id
       WHERE l.owner_id = $1
         AND (lv.created_at AT TIME ZONE $3)::date >= $2::date
       GROUP BY 1, 2`,
      [userId, since, PREMIUM_DEFAULTS.TIME_ZONE],
    );

    return this.toRows(rows);
  }

  private async queryContacts(userId: string, since: string) {
    const rows: unknown = await this.dataSource.query(
      `SELECT day, SUM(total)::text AS total FROM (
         SELECT (c.created_at AT TIME ZONE $3)::date::text AS day, COUNT(*) AS total
         FROM conversations c
         WHERE c.landlord_id = $1
           AND (c.created_at AT TIME ZONE $3)::date >= $2::date
         GROUP BY 1
         UNION ALL
         SELECT (b.created_at AT TIME ZONE $3)::date::text AS day, COUNT(*) AS total
         FROM bookings b
         INNER JOIN listings l ON l.id = b.listing_id
         WHERE l.owner_id = $1
           AND (b.created_at AT TIME ZONE $3)::date >= $2::date
         GROUP BY 1
       ) contacts
       GROUP BY day`,
      [userId, since, PREMIUM_DEFAULTS.TIME_ZONE],
    );

    return this.toRows(rows);
  }

  private toRows(rows: unknown): DailyRow[] {
    return Array.isArray(rows)
      ? (rows as unknown[]).filter(
          (row): row is DailyRow =>
            typeof row === 'object' &&
            row !== null &&
            'day' in row &&
            'total' in row,
        )
      : [];
  }
}

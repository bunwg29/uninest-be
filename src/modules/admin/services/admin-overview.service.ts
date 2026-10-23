import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { ADMIN_OVERVIEW_SERIES_DAYS, ADMIN_TIMEZONE } from '../constants';
import { Report, ReportStatus } from '../entities';

interface SeriesRow {
  day: string;
  submitted: string;
  approved: string;
  rejected: string;
}

@Injectable()
export class AdminOverviewService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async get() {
    const listings = this.dataSource.getRepository(Listing);
    const [
      pendingListings,
      pendingReports,
      activeListings,
      users,
      signups,
      series,
    ] = await Promise.all([
      listings.count({ where: { status: ListingStatus.PENDING } }),
      this.countPendingReportGroups(),
      listings.count({ where: { status: ListingStatus.ACTIVE } }),
      this.dataSource.getRepository(User).count(),
      this.countSignups(),
      this.getSeries(),
    ]);

    return {
      pendingListings,
      pendingReports,
      activeListings,
      users,
      newUsersToday: signups.today,
      newUsersYesterday: signups.yesterday,
      series,
    };
  }

  private async countPendingReportGroups() {
    const row = await this.dataSource
      .getRepository(Report)
      .createQueryBuilder('report')
      .select('COUNT(DISTINCT (report.entityType, report.entityId))', 'total')
      .where('report.status = :status', { status: ReportStatus.PENDING })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  private async countSignups() {
    const [row] = await this.dataSource.query<
      { today: string; yesterday: string }[]
    >(
      `SELECT
        COUNT(*) FILTER (WHERE (created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date) AS today,
        COUNT(*) FILTER (WHERE (created_at AT TIME ZONE $1)::date = (now() AT TIME ZONE $1)::date - 1) AS yesterday
      FROM users`,
      [ADMIN_TIMEZONE],
    );

    return {
      today: Number(row?.today ?? 0),
      yesterday: Number(row?.yesterday ?? 0),
    };
  }

  private async getSeries() {
    const rows = await this.dataSource.query<SeriesRow[]>(
      `WITH days AS (
        SELECT generate_series(
          (now() AT TIME ZONE $1)::date - ($2::int - 1),
          (now() AT TIME ZONE $1)::date,
          interval '1 day'
        )::date AS day
      )
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS day,
        (SELECT COUNT(*) FROM listings listing WHERE listing.deleted_at IS NULL AND (listing.created_at AT TIME ZONE $1)::date = days.day) AS submitted,
        (SELECT COUNT(*) FROM audit_logs audit WHERE audit.action = 'listing.approve' AND (audit.created_at AT TIME ZONE $1)::date = days.day) AS approved,
        (SELECT COUNT(*) FROM audit_logs audit WHERE audit.action = 'listing.reject' AND (audit.created_at AT TIME ZONE $1)::date = days.day) AS rejected
      FROM days
      ORDER BY days.day`,
      [ADMIN_TIMEZONE, ADMIN_OVERVIEW_SERIES_DAYS],
    );

    return rows.map((row) => ({
      day: row.day,
      submitted: Number(row.submitted),
      approved: Number(row.approved),
      rejected: Number(row.rejected),
    }));
  }
}

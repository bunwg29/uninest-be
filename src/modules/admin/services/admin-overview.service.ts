import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { Report, ReportStatus } from '../entities';

@Injectable()
export class AdminOverviewService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async get() {
    const [pendingListings, pendingReports, activeListings, users] =
      await Promise.all([
        this.dataSource.getRepository(Listing).count({
          where: { status: ListingStatus.PENDING },
        }),
        this.dataSource.getRepository(Report).count({
          where: { status: ReportStatus.PENDING },
        }),
        this.dataSource.getRepository(Listing).count({
          where: { status: ListingStatus.ACTIVE },
        }),
        this.dataSource.getRepository(User).count(),
      ]);

    return { pendingListings, pendingReports, activeListings, users };
  }
}

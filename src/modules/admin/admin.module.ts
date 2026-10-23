import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingsModule } from '@modules/listings/listings.module';
import { Listing } from '@modules/listings/entities';
import { User } from '@modules/users/entities';
import { AdminController } from './controllers/admin.controller';
import { UserReportController } from './controllers/user-report.controller';
import { AuditLog, Report } from './entities';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminListingsService } from './services/admin-listings.service';
import { AdminOverviewService } from './services/admin-overview.service';
import { AdminReportsService } from './services/admin-reports.service';
import { AdminUsersService } from './services/admin-users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, Report, Listing, User]),
    ListingsModule,
  ],
  controllers: [AdminController, UserReportController],
  providers: [
    AdminAuditService,
    AdminListingsService,
    AdminOverviewService,
    AdminReportsService,
    AdminUsersService,
  ],
})
export class AdminModule {}

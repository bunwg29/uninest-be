import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import {
  AdminAuditQueryDto,
  AdminListingsQueryDto,
  AdminReasonDto,
  AdminReportsQueryDto,
  AdminUsersQueryDto,
  ResolveReportDto,
} from '../dtos';
import { AdminAuditService } from '../services/admin-audit.service';
import { AdminListingsService } from '../services/admin-listings.service';
import { AdminOverviewService } from '../services/admin-overview.service';
import { AdminReportsService } from '../services/admin-reports.service';
import { AdminUsersService } from '../services/admin-users.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly overviewService: AdminOverviewService,
    private readonly listingsService: AdminListingsService,
    private readonly reportsService: AdminReportsService,
    private readonly usersService: AdminUsersService,
    private readonly auditService: AdminAuditService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Lấy số liệu tổng quan quản trị' })
  getOverview() {
    return this.overviewService.get();
  }

  @Get('listings')
  @ApiOperation({ summary: 'Lấy danh sách tin đăng để kiểm duyệt' })
  getListings(@Query() query: AdminListingsQueryDto) {
    return this.listingsService.list(query);
  }

  @Get('listings/provinces')
  @ApiOperation({ summary: 'Lấy danh sách tỉnh/thành có tin đăng' })
  getListingProvinces() {
    return this.listingsService.listProvinces();
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Lấy chi tiết tin đăng để kiểm duyệt' })
  getListing(
    @CurrentUser('userId') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listingsService.getDetail(actorId, id);
  }

  @Patch('listings/:id/approve')
  @ApiOperation({ summary: 'Duyệt tin đăng chờ kiểm duyệt' })
  approveListing(
    @CurrentUser('userId') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listingsService.approve(actorId, id);
  }

  @Patch('listings/:id/reject')
  @ApiOperation({ summary: 'Từ chối tin đăng kèm lý do' })
  rejectListing(
    @CurrentUser('userId') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReasonDto,
  ) {
    return this.listingsService.reject(actorId, id, dto.reason);
  }

  @Patch('listings/:id/hide')
  @ApiOperation({ summary: 'Ẩn tin đang hiển thị kèm lý do' })
  hideListing(
    @CurrentUser('userId') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReasonDto,
  ) {
    return this.listingsService.hide(actorId, id, dto.reason);
  }

  @Patch('listings/:id/restore')
  @ApiOperation({ summary: 'Hiện lại tin do quản trị viên ẩn' })
  restoreListing(
    @CurrentUser('userId') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReasonDto,
  ) {
    return this.listingsService.restore(actorId, id, dto.reason);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Lấy danh sách báo cáo vi phạm tập trung' })
  getReports(@Query() query: AdminReportsQueryDto) {
    return this.reportsService.list(query);
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Lấy chi tiết một nhóm báo cáo' })
  getReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.getDetail(id);
  }

  @Patch('reports/:id/resolve')
  @ApiOperation({ summary: 'Xử lý báo cáo vi phạm và ghi nhật ký' })
  resolveReport(
    @CurrentUser('userId') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reportsService.resolve(actorId, id, dto.action, dto.reason);
  }

  @Get('users')
  @ApiOperation({ summary: 'Lấy danh sách tài khoản' })
  getUsers(@Query() query: AdminUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Lấy chi tiết tài khoản' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getDetail(id);
  }

  @Patch('users/:id/lock')
  @ApiOperation({ summary: 'Khoá tài khoản và ẩn tin của chủ trọ' })
  lockUser(
    @CurrentUser('userId') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReasonDto,
  ) {
    return this.usersService.setLocked(actorId, id, true, dto.reason);
  }

  @Patch('users/:id/unlock')
  @ApiOperation({ summary: 'Mở khoá tài khoản' })
  unlockUser(
    @CurrentUser('userId') actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReasonDto,
  ) {
    return this.usersService.setLocked(actorId, id, false, dto.reason);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Tra cứu nhật ký hành động quản trị' })
  getAuditLogs(@Query() query: AdminAuditQueryDto) {
    return this.auditService.list(query);
  }
}

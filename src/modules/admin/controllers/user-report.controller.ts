import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { ReportUserDto } from '../dtos';
import { AdminReportsService } from '../services/admin-reports.service';

@ApiTags('User reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.STUDENT, UserRoleType.LANDLORD)
@Controller('users')
export class UserReportController {
  constructor(private readonly reportsService: AdminReportsService) {}

  @Post(':id/reports')
  @ApiOperation({ summary: 'Báo cáo tài khoản vi phạm' })
  reportUser(
    @CurrentUser('userId') reporterId: string,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: ReportUserDto,
  ) {
    return this.reportsService.reportUser(reporterId, userId, dto);
  }
}

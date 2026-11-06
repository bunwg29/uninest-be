import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { PremiumStatsQueryDto } from './dtos';
import { PremiumService, PremiumStatsService } from './services';

@ApiTags('Premium')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.LANDLORD)
@Controller('premium')
export class PremiumController {
  constructor(
    private readonly premiumService: PremiumService,
    private readonly premiumStatsService: PremiumStatsService,
  ) {}

  @Get('plans')
  @ApiOperation({ summary: 'Danh sách gói Premium và giá' })
  getPlans() {
    return this.premiumService.getPlans();
  }

  @Get('me')
  @ApiOperation({ summary: 'Trạng thái Premium và ngày hết hạn của chủ trọ' })
  getStatus(@CurrentUser('userId') userId: string) {
    return this.premiumService.getStatus(userId);
  }

  @Get('stats')
  @ApiOperation({
    summary:
      'Thống kê nâng cao: lượt xem theo ngày, nguồn truy cập, tỉ lệ chuyển đổi (chỉ Premium)',
  })
  getStats(
    @CurrentUser('userId') userId: string,
    @Query() query: PremiumStatsQueryDto,
  ) {
    return this.premiumStatsService.getStats(userId, query.period);
  }
}

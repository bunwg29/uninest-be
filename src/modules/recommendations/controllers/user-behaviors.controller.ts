import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { RecordSearchBehaviorDto } from '../dtos';
import { UserBehaviorsService } from '../services';

@ApiTags('Gợi ý cá nhân hoá')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.STUDENT)
@Controller('users/me/behaviors')
export class UserBehaviorsController {
  constructor(private readonly userBehaviorsService: UserBehaviorsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Số liệu hành vi dùng để cá nhân hoá (SH-05)',
  })
  getSummary(@CurrentUser('userId') userId: string) {
    return this.userBehaviorsService.getSummary(userId);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi nhận từ khoá / bộ lọc sinh viên đã tìm' })
  recordSearch(
    @CurrentUser('userId') userId: string,
    @Body() dto: RecordSearchBehaviorDto,
  ) {
    return this.userBehaviorsService.recordSearch(userId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xoá lịch sử hành vi dùng để cá nhân hoá (NFR-SEC-04)',
    description:
      'Không ảnh hưởng phòng đã lưu, lịch hẹn và tin nhắn; gợi ý quay về mặc định.',
  })
  async deleteAll(@CurrentUser('userId') userId: string): Promise<void> {
    await this.userBehaviorsService.deleteAll(userId);
  }
}

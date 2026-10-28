import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { RecommendationsQueryDto } from '../dtos';
import { RecommendationsService } from '../services';

@ApiTags('Gợi ý cá nhân hoá')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.STUDENT)
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách "Gợi ý dành cho bạn" xếp theo mức độ phù hợp',
    description:
      'Chỉ dùng hành vi của chính sinh viên; chưa đủ hành vi thì trả tin phổ biến trong khu vực (isFallback).',
  })
  @ApiOkResponse({ description: 'Danh sách tin gợi ý' })
  getRecommendations(
    @CurrentUser('userId') userId: string,
    @Query() query: RecommendationsQueryDto,
  ) {
    return this.recommendationsService.getRecommendations(userId, query.limit);
  }
}

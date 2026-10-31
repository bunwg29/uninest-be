import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Public, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import {
  CreateReviewDto,
  ReplyReviewDto,
  ReportReviewDto,
  ReviewListQueryDto,
  UpdateReviewDto,
} from './dtos';
import { ReviewsService } from './services';

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('listings/:listingId/reviews')
  @Public()
  @ApiOperation({ summary: 'Lấy danh sách đánh giá của tin đăng' })
  list(
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Query() query: ReviewListQueryDto,
  ) {
    return this.reviewsService.list(listingId, query);
  }

  @Get('listings/:listingId/reviews/eligibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Kiểm tra điều kiện đánh giá theo lịch sử xem phòng',
  })
  getEligibility(
    @CurrentUser('userId') studentId: string,
    @Param('listingId', ParseUUIDPipe) listingId: string,
  ) {
    return this.reviewsService.getEligibility(studentId, listingId);
  }

  @Post('listings/:listingId/reviews')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo đánh giá sau lịch xem phòng đã xác nhận' })
  create(
    @CurrentUser('userId') studentId: string,
    @Param('listingId', ParseUUIDPipe) listingId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(studentId, listingId, dto);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sửa đánh giá trong vòng 7 ngày' })
  update(
    @CurrentUser('userId') studentId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(studentId, id, dto);
  }

  @Post('reviews/:id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chủ trọ phản hồi công khai một lần' })
  reply(
    @CurrentUser('userId') landlordId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewsService.reply(landlordId, id, dto);
  }

  @Post('reviews/:id/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chủ trọ báo cáo đánh giá sai sự thật' })
  report(
    @CurrentUser('userId') landlordId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportReviewDto,
  ) {
    return this.reviewsService.report(landlordId, id, dto);
  }
}

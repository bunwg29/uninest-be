import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '@common/decorators';
import { UserRoleType } from '@common/constants';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import {
  CreateListingDto,
  LandlordListingsQueryDto,
  ReportListingDto,
  UpdateListingStatusDto,
} from '../dtos';
import { ListingsService } from '../services/listings.service';

const LISTING_ID_PIPE = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException('Mã định danh tin đăng không hợp lệ'),
});

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get('amenities')
  @Public()
  @ApiOperation({
    summary: 'Lấy danh mục tiện ích phòng trọ',
    description:
      'Trả về danh sách tiện ích hoạt động có mã số và nhóm số (0 = Nội thất, 1 = Tiện ích, ...)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách tiện ích thành công',
  })
  async getAmenities() {
    return this.listingsService.getAmenities();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo tin đăng phòng trọ mới',
    description: 'Tạo tin đăng ở trạng thái chờ duyệt cho chủ trọ đã đăng nhập',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo tin đăng thành công',
  })
  async create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.createListing(userId, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách tin đăng của chủ trọ hiện tại' })
  async getMine(
    @CurrentUser('userId') userId: string,
    @Query() query: LandlordListingsQueryDto,
  ) {
    const result = await this.listingsService.getLandlordListings(
      userId,
      query,
    );

    return {
      items: result.items,
      totalCount: result.pagination.total,
      counters: result.countsByStatus,
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.STUDENT, UserRoleType.LANDLORD, UserRoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết tin đăng' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy chi tiết tin đăng thành công',
  })
  async getDetail(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleId') roleId: UserRoleType,
    @Param('id', LISTING_ID_PIPE) id: string,
  ) {
    return this.listingsService.getListingDetail(userId, roleId, id);
  }

  @Patch(':id/view')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.STUDENT, UserRoleType.LANDLORD, UserRoleType.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ghi nhận lượt xem tin đăng' })
  async recordView(
    @CurrentUser('userId') userId: string,
    @CurrentUser('roleId') roleId: UserRoleType,
    @Param('id', LISTING_ID_PIPE) id: string,
  ) {
    return this.listingsService.recordView(userId, roleId, id);
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lưu tin đăng vào danh sách yêu thích' })
  async addFavorite(
    @CurrentUser('userId') userId: string,
    @Param('id', LISTING_ID_PIPE) id: string,
  ) {
    return this.listingsService.addFavorite(userId, id);
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bỏ lưu tin đăng khỏi danh sách yêu thích' })
  async removeFavorite(
    @CurrentUser('userId') userId: string,
    @Param('id', LISTING_ID_PIPE) id: string,
  ): Promise<void> {
    await this.listingsService.removeFavorite(userId, id);
  }

  @Post(':id/reports')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Báo cáo tin đăng vi phạm (D-09)' })
  async reportListing(
    @CurrentUser('userId') userId: string,
    @Param('id', LISTING_ID_PIPE) id: string,
    @Body() dto: ReportListingDto,
  ) {
    return this.listingsService.reportListing(userId, id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ẩn hoặc hiển thị lại tin đăng' })
  async updateStatus(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingStatusDto,
  ) {
    return this.listingsService.updateListingStatus(userId, id, dto.status);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật tin đăng của chủ trọ' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.updateListing(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Xoá mềm tin đăng; tin đã có lịch hẹn/giữ chỗ chuyển sang "Ngừng nhận yêu cầu"',
  })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listingsService.deleteListing(userId, id);
  }
}

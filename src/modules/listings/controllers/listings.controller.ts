import {
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
  UpdateListingStatusDto,
} from '../dtos';
import { ListingsService } from '../services/listings.service';

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
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xoá mềm tin đăng của chủ trọ' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.listingsService.deleteListing(userId, id);
  }
}

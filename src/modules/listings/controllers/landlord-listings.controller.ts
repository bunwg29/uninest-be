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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import {
  CreateListingDto,
  LandlordListingsQueryDto,
  UpdateListingVisibilityDto,
} from '../dtos';
import { ListingStatus } from '../entities';
import { ListingsService } from '../services/listings.service';

@ApiTags('Landlord Listings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.LANDLORD)
@Controller('landlord/listings')
export class LandlordListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tin đăng của chủ trọ' })
  async findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: LandlordListingsQueryDto,
  ) {
    return this.listingsService.getLandlordListings(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết tin đăng thuộc chủ trọ' })
  async findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listingsService.getLandlordListing(userId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật và gửi duyệt lại tin đăng' })
  async update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.updateListing(userId, id, dto);
  }

  @Patch(':id/visibility')
  @ApiOperation({ summary: 'Ẩn hoặc hiện nhanh tin đăng' })
  async updateVisibility(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingVisibilityDto,
  ) {
    return this.listingsService.updateListingStatus(
      userId,
      id,
      dto.hidden ? ListingStatus.HIDDEN : ListingStatus.ACTIVE,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá mềm tin đăng thuộc chủ trọ' })
  async remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.listingsService.deleteListing(userId, id);
  }
}

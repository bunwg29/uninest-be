import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@common/decorators';
import { UserRoleType } from '@common/constants';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { CreateListingDto } from '../dtos';
import { ListingsService } from '../services/listings.service';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

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
}

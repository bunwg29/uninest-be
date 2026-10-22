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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '@common/decorators';
import { UserRoleType } from '@common/constants';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import {
  BookingListQueryDto,
  BookingReasonDto,
  BookingSlotsQueryDto,
  CancelBookingDto,
  CreateBookingDto,
} from './dto';
import { BookingService } from './services';

@ApiTags('Bookings')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('slots')
  @Public()
  @ApiOperation({ summary: 'Lấy các khung giờ có thể đặt lịch xem phòng' })
  getSlots(@Query() query: BookingSlotsQueryDto) {
    return this.bookingService.getSlots(query);
  }

  @Post()
  @Roles(UserRoleType.STUDENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo yêu cầu xem phòng' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookingService.create(userId, dto);
  }

  @Get()
  @Roles(UserRoleType.STUDENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn của người dùng hiện tại' })
  findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: BookingListQueryDto,
  ) {
    return this.bookingService.findAll(userId, query);
  }

  @Get('landlord')
  @Roles(UserRoleType.LANDLORD)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Chủ trọ xem yêu cầu xem phòng của các tin mình đăng',
  })
  findAllForLandlord(
    @CurrentUser('userId') userId: string,
    @Query() query: BookingListQueryDto,
  ) {
    return this.bookingService.findAllForLandlord(userId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết lịch hẹn và dòng thời gian' })
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingService.findOne(userId, id);
  }

  @Patch(':id/confirm')
  @Roles(UserRoleType.LANDLORD)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chủ trọ xác nhận lịch hẹn' })
  confirm(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingService.confirm(userId, id);
  }

  @Patch(':id/reject')
  @Roles(UserRoleType.LANDLORD)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chủ trọ từ chối lịch hẹn kèm lý do' })
  reject(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookingReasonDto,
  ) {
    return this.bookingService.reject(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRoleType.STUDENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy lịch hẹn' })
  cancel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingService.cancel(userId, id, dto);
  }
}

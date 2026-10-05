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
import { CurrentUser, Public } from '@common/decorators';
import { JwtAuthGuard } from '@common/guards';
import {
  BookingListQueryDto,
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo yêu cầu xem phòng' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookingService.create(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn của người dùng hiện tại' })
  findAll(
    @CurrentUser('userId') userId: string,
    @Query() query: BookingListQueryDto,
  ) {
    return this.bookingService.findAll(userId, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy chi tiết lịch hẹn và dòng thời gian' })
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingService.findOne(userId, id);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chủ trọ xác nhận lịch hẹn' })
  confirm(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingService.confirm(userId, id);
  }

  @Patch(':id/hold')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chuyển yêu cầu sang trạng thái giữ chỗ' })
  hold(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingService.hold(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
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

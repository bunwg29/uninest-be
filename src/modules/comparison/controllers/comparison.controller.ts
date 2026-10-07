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
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Roles } from '@common/decorators';
import { UserRoleType } from '@common/constants';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { COMPARISON_ERROR_MESSAGES } from '../constants';
import { AddComparisonItemDto, AddComparisonItemResponseDto } from '../dtos';
import { ComparisonService } from '../services';

const LISTING_ID_PIPE = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException(COMPARISON_ERROR_MESSAGES.INVALID_LISTING_ID),
});

@ApiTags('Comparison')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.STUDENT)
@Controller('comparison')
export class ComparisonController {
  constructor(private readonly comparisonService: ComparisonService) {}

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách phòng đang so sánh',
    description:
      'Trả về các phòng theo thứ tự thêm vào, kèm chi tiết tin đăng. Phòng không còn hiển thị được đánh dấu isAvailable = false cùng unavailableReason và không bị xoá khỏi danh sách.',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Danh sách so sánh' })
  async listItems(@CurrentUser('userId') userId: string) {
    return this.comparisonService.listItems(userId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Thêm phòng vào danh sách so sánh',
    description:
      'Thêm lặp lại cùng một phòng trả về added = false. Tối đa 4 phòng mỗi người dùng.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: AddComparisonItemResponseDto })
  @ApiNotFoundResponse({ description: 'Không tìm thấy tin đăng' })
  @ApiConflictResponse({
    description: 'Tin đăng không còn hiển thị hoặc danh sách đã đủ 4 phòng',
  })
  async addItem(
    @CurrentUser('userId') userId: string,
    @Body() dto: AddComparisonItemDto,
  ) {
    return this.comparisonService.addItem(userId, dto.listingId);
  }

  @Delete(':listingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bỏ một phòng khỏi danh sách so sánh' })
  async removeItem(
    @CurrentUser('userId') userId: string,
    @Param('listingId', LISTING_ID_PIPE) listingId: string,
  ): Promise<void> {
    await this.comparisonService.removeItem(userId, listingId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá toàn bộ danh sách so sánh' })
  async clearItems(@CurrentUser('userId') userId: string): Promise<void> {
    await this.comparisonService.clearItems(userId);
  }
}

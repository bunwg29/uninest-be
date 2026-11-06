import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@common/decorators';
import { UserRoleType } from '@common/constants';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import {
  CreateSavedSearchDto,
  NotificationQueryDto,
  UpdateSavedSearchDto,
} from './dtos';
import { SavedSearchesService } from './services/saved-searches.service';

@ApiTags('Saved Searches')
@Controller('saved-searches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleType.STUDENT)
@ApiBearerAuth()
export class SavedSearchesController {
  constructor(private readonly searches: SavedSearchesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách bộ lọc đã lưu' })
  list(
    @CurrentUser('userId') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    return this.searches.list(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Lưu bộ lọc để nhận thông báo phòng mới' })
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateSavedSearchDto,
  ) {
    return this.searches.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Đổi tên hoặc bật tắt bộ lọc đã lưu' })
  update(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSavedSearchDto,
  ) {
    return this.searches.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xoá bộ lọc đã lưu' })
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.searches.remove(userId, id);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '@common/decorators';
import { UserRoleType } from '@common/constants';
import { PaginationQueryDto } from '@common/dtos';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { SearchListingsQueryDto, SearchListingsResponseDto } from './dto';
import { SearchService } from './search.service';
import { ListingsSearchRepository } from './search.repository';

@ApiTags('Search')
@Controller('listings')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly searchRepository: ListingsSearchRepository,
  ) {}

  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Tìm kiếm và lọc phòng trọ công khai',
    description:
      'Chỉ trả về tin đang hiển thị, hỗ trợ bộ lọc kết hợp và khoảng cách PostGIS.',
  })
  @ApiOkResponse({
    description: 'Tìm kiếm phòng thành công',
    type: SearchListingsResponseDto,
  })
  async search(@Query() query: SearchListingsQueryDto) {
    const data = await this.searchService.search(query);

    return {
      data,
      messages: 'Tìm kiếm phòng thành công',
    };
  }

  @Get('favorites')
  @Roles(UserRoleType.STUDENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách phòng đã lưu của sinh viên (S-12)' })
  @ApiOkResponse({ type: SearchListingsResponseDto })
  async listFavorites(
    @CurrentUser('userId') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const data = await this.searchRepository.listFavorites(
      userId,
      query.page,
      query.limit,
    );

    return { data, messages: 'Lấy danh sách phòng đã lưu thành công' };
  }

  @Get('favorites/ids')
  @Roles(UserRoleType.STUDENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mã các phòng sinh viên đã lưu' })
  async listFavoriteIds(@CurrentUser('userId') userId: string) {
    const data = await this.searchRepository.listFavoriteIds(userId);

    return { data, messages: 'Lấy mã phòng đã lưu thành công' };
  }
}

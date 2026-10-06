import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators';
import { SearchListingsQueryDto, SearchListingsResponseDto } from './dto';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('listings')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

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
}

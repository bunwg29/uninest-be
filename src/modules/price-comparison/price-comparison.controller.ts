import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators';
import { PriceComparisonQueryDto } from './dtos';
import { PriceComparisonService } from './services';

@ApiTags('So sánh giá')
@Controller('price-comparison')
export class PriceComparisonController {
  constructor(
    private readonly priceComparisonService: PriceComparisonService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Lấy giá thuê tổng hợp theo khu vực và loại phòng',
  })
  @ApiOkResponse({ description: 'Dữ liệu giá thuê đã được tổng hợp sẵn' })
  findAll(@Query() query: PriceComparisonQueryDto) {
    return this.priceComparisonService.findAll(query);
  }
}

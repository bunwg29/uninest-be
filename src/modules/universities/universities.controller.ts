import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UniversitiesQueryDto } from './dtos';
import { UniversitiesService } from './universities.service';

@ApiTags('Trường đại học')
@Controller('universities')
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Tìm trường đại học theo tên hoặc mã' })
  async search(@Query() query: UniversitiesQueryDto) {
    return this.universitiesService.search(query);
  }
}

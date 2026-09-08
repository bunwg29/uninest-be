import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LocationsService } from './locations.service';
import { Province, Ward } from './entities';

@ApiTags('Địa lý & Hành chính')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'Lấy danh sách tất cả các tỉnh/thành phố' })
  @ApiResponse({ status: 200, description: 'Danh sách tỉnh/thành phố' })
  async getProvinces(): Promise<Province[]> {
    return this.locationsService.getProvinces();
  }

  @Get('provinces/:code/wards')
  @ApiOperation({ summary: 'Lấy danh sách phường/xã thuộc một tỉnh/thành phố' })
  @ApiResponse({ status: 200, description: 'Danh sách phường/xã' })
  async getWardsByProvinceCode(
    @Param('code') provinceCode: string,
  ): Promise<Ward[]> {
    return this.locationsService.getWardsByProvinceCode(provinceCode);
  }

  @Get('wards/:code')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết của một phường/xã' })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết phường/xã' })
  async getWardByCode(@Param('code') code: string): Promise<Ward> {
    return this.locationsService.getWardByCode(code);
  }
}

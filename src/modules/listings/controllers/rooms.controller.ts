import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@common/decorators';
import { ListingsService } from '../services/listings.service';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lấy toàn bộ danh sách phòng trọ' })
  findAll() {
    return this.listingsService.getPublicRooms();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Lấy chi tiết một phòng trọ' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.listingsService.getPublicRoom(id);
  }
}

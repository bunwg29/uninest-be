import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@common/decorators';
import { JwtAuthGuard } from '@common/guards';
import { LandlordPublicProfileDto } from './dtos';
import { LandlordProfileService } from './landlord-profile.service';

@ApiTags('Landlord Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('landlords')
export class LandlordProfileController {
  constructor(
    private readonly landlordProfileService: LandlordProfileService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Xem hồ sơ công khai của chủ trọ' })
  async getPublicProfile(
    @CurrentUser('userId') viewerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LandlordPublicProfileDto> {
    return this.landlordProfileService.getPublicProfile(viewerId, id);
  }
}

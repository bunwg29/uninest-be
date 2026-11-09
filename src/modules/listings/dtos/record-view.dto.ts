import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { LISTING_VIEW_SOURCES, type ListingViewSource } from '../constants';

export class RecordViewDto {
  @ApiPropertyOptional({
    description: 'Nguồn truy cập vào tin đăng',
    enum: LISTING_VIEW_SOURCES,
    default: 'other',
  })
  @IsOptional()
  @IsIn(LISTING_VIEW_SOURCES, { message: 'Nguồn truy cập không hợp lệ' })
  source: ListingViewSource = 'other';
}

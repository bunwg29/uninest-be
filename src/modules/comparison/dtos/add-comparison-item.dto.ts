import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddComparisonItemDto {
  @ApiProperty({ format: 'uuid', description: 'Mã tin đăng cần so sánh' })
  @IsUUID('all', { message: 'Mã định danh tin đăng không hợp lệ' })
  listingId!: string;
}

export class AddComparisonItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  listingId!: string;

  @ApiProperty({
    description: 'false khi tin đăng đã có sẵn trong danh sách so sánh',
  })
  added!: boolean;

  @ApiProperty({ description: 'Số phòng hiện có trong danh sách so sánh' })
  count!: number;

  @ApiProperty({ description: 'Số phòng tối đa được so sánh' })
  maxItems!: number;
}

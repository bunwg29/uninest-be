import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export const MAX_BATCH_LISTING_IDS = 20;

export class ListingIdsQueryDto {
  @ApiProperty({
    description: 'Danh sách mã tin đăng, phân tách bằng dấu phẩy',
    example: 'b3c1...,9f2a...',
    type: String,
  })
  @Transform(({ value }: { value: unknown }) => {
    const parts: unknown[] = Array.isArray(value) ? value : [value];

    return parts
      .flatMap((part) => (typeof part === 'string' ? part.split(',') : []))
      .map((id) => id.trim())
      .filter(Boolean);
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 mã tin đăng' })
  @ArrayMaxSize(MAX_BATCH_LISTING_IDS, {
    message: `Chỉ lấy tối đa ${MAX_BATCH_LISTING_IDS} tin đăng mỗi lần`,
  })
  @IsUUID('4', { each: true, message: 'Mã tin đăng không hợp lệ' })
  ids!: string[];
}

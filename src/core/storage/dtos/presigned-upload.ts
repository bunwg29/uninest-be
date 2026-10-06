import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { STORAGE_LIMITS } from '../storage.constants';

export class CreatePresignedUploadUrlDto {
  @ApiProperty({
    description: 'Tên tệp gốc',
    example: 'room-photo-1.jpg',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    description: 'Loại tệp ảnh, chỉ nhận jpg hoặc png',
    example: 'image/jpeg',
    enum: STORAGE_LIMITS.ALLOWED_IMAGE_TYPES,
  })
  @IsString()
  @IsIn([...STORAGE_LIMITS.ALLOWED_IMAGE_TYPES], {
    message: 'Chỉ hỗ trợ ảnh định dạng jpg hoặc png',
  })
  contentType!: string;

  @ApiPropertyOptional({
    description: 'Dung lượng ảnh theo byte, tối đa 5MB',
    example: 1048576,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(STORAGE_LIMITS.MAX_IMAGE_BYTES, {
    message: 'Mỗi ảnh có dung lượng tối đa 5MB',
  })
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Thư mục lưu ảnh theo mục đích sử dụng',
    example: 'listings',
    enum: ['listings', 'avatars', 'chat', 'forum'],
    default: 'listings',
  })
  @IsOptional()
  @IsString()
  @IsIn(['listings', 'avatars', 'chat', 'forum'], {
    message: 'Thư mục lưu ảnh không hợp lệ',
  })
  folder?: string;
}

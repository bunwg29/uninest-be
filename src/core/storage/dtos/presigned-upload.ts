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
    description: 'Dung lượng ảnh theo byte, tối đa 100MB',
    example: 1048576,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(STORAGE_LIMITS.MAX_IMAGE_BYTES, {
    message: 'Mỗi ảnh có dung lượng tối đa 100MB',
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

export class CreatePresignedVideoUploadDto {
  @ApiProperty({ description: 'Tên tệp gốc', example: 'room-tour.mp4' })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    description: 'Loại tệp video, chỉ nhận mp4 hoặc mov',
    example: 'video/mp4',
    enum: STORAGE_LIMITS.ALLOWED_VIDEO_TYPES,
  })
  @IsString()
  @IsIn([...STORAGE_LIMITS.ALLOWED_VIDEO_TYPES], {
    message: 'Chỉ hỗ trợ video định dạng mp4 hoặc mov',
  })
  contentType!: string;

  @ApiPropertyOptional({
    description: 'Dung lượng video theo byte, tối đa 100MB',
    example: 10485760,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(STORAGE_LIMITS.MAX_VIDEO_BYTES, {
    message: 'Video có dung lượng tối đa 100MB',
  })
  fileSize?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreatePresignedUploadUrlDto {
  @ApiProperty({
    description: 'Original file name with extension',
    example: 'room-photo-1.jpg',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    description: 'MIME type of the image file',
    example: 'image/jpeg',
  })
  @IsString()
  @Matches(/^image\/(jpeg|png|webp|gif|heic)$/, {
    message:
      'Chỉ hỗ trợ các định dạng ảnh (jpeg, png, webp, gif, heic) khi tải lên ảnh phòng hoặc ảnh đại diện',
  })
  contentType!: string;

  @ApiPropertyOptional({
    description: 'Folder/prefix where image is stored',
    example: 'listings',
    enum: ['listings', 'avatars', 'chat'],
    default: 'listings',
  })
  @IsOptional()
  @IsString()
  folder?: string;
}

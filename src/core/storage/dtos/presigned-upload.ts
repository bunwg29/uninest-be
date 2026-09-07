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
      'Only image formats (jpeg, png, webp, gif, heic) are supported for room/avatar uploads',
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

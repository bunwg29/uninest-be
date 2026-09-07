import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { R2StorageService } from './r2-storage.service';
import { CreatePresignedUploadUrlDto } from './dtos/presigned-upload';
import { PresignedUploadUrlResponse } from './r2-storage.interface';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: R2StorageService) {}

  @Post('presigned-upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate presigned URL for direct image upload to Cloudflare R2',
    description:
      'Returns a temporary presigned PUT URL allowing mobile client to upload image directly to R2 bucket without routing binary data through the server.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Presigned upload URL generated successfully',
  })
  async createPresignedUploadUrl(
    @Body() dto: CreatePresignedUploadUrlDto,
  ): Promise<PresignedUploadUrlResponse> {
    return this.storageService.generatePresignedUploadUrlForImage(
      dto.fileName,
      dto.contentType,
      dto.folder,
    );
  }
}

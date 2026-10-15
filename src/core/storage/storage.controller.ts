import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards';
import { R2StorageService } from './r2-storage.service';
import {
  CreatePresignedUploadUrlDto,
  CreatePresignedVideoUploadDto,
} from './dtos/presigned-upload';
import { PresignedUploadUrlResponse } from './r2-storage.interface';

@ApiTags('Storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: R2StorageService) {}

  @Post('presign-video-upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Tạo presigned URL (hiệu lực 5 phút) để tải video tin đăng hoặc bài viết forum lên R2',
    description:
      'Chỉ nhận video mp4/mov tối đa 100MB. Backend kiểm tra lại định dạng và dung lượng đối tượng sau khi tải lên.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tạo presigned URL thành công',
  })
  async createPresignedVideoUploadUrl(
    @Body() dto: CreatePresignedVideoUploadDto,
  ): Promise<PresignedUploadUrlResponse> {
    return this.storageService.generatePresignedUploadUrlForVideo(
      dto.contentType,
      dto.folder,
    );
  }

  @Post(['presign-upload', 'presigned-upload-url'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tạo presigned URL (hiệu lực 5 phút) để tải ảnh trực tiếp lên R2',
    description:
      'Chỉ nhận ảnh jpg/png tối đa 100MB. Backend kiểm tra lại định dạng và dung lượng đối tượng sau khi tải lên.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tạo presigned URL thành công',
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

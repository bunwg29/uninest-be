import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PresignedUploadUrlOptions,
  PresignedUploadUrlResponse,
  PresignedDownloadUrlResponse,
} from './r2-storage.interface';
import { STORAGE_LIMITS } from './storage.constants';

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );

    this.bucketName = this.configService.get<string>(
      'R2_BUCKET_NAME',
      'uninest-assets',
    );
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL', '');

    if (accountId && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isConfigured = true;
      this.logger.log(
        `Cloudflare R2 storage initialized for bucket: ${this.bucketName}`,
      );
    } else {
      this.isConfigured = false;
      this.logger.warn(
        'Cloudflare R2 credentials are not set in .env. Presigned URLs will run in mock mode.',
      );
    }
  }

  private resolvePublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }

    return `https://${this.bucketName}.r2.cloudflarestorage.com/${key}`;
  }

  async generatePresignedUploadUrlForImage(
    _fileName: string,
    contentType: string,
    folder: string = 'listings',
  ): Promise<PresignedUploadUrlResponse> {
    const sanitizedExt = contentType === 'image/png' ? 'png' : 'jpg';
    const randomId = randomUUID();
    const cleanFolder =
      folder
        .split('/')
        .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ''))
        .filter(Boolean)
        .join('/') || 'listings';
    const key = `${cleanFolder}/${Date.now()}-${randomId}.${sanitizedExt}`;

    return this.getPresignedUploadUrl({
      key,
      contentType,
      expiresInSeconds: STORAGE_LIMITS.PRESIGN_EXPIRES_SECONDS,
    });
  }

  async getPresignedUploadUrl(
    options: PresignedUploadUrlOptions,
  ): Promise<PresignedUploadUrlResponse> {
    const expiresIn =
      options.expiresInSeconds ?? STORAGE_LIMITS.PRESIGN_EXPIRES_SECONDS;

    if (!this.isConfigured || !this.s3Client) {
      return {
        uploadUrl: `https://mock-r2.uninest.local/upload/${options.key}`,
        publicUrl: this.resolvePublicUrl(options.key),
        key: options.key,
        expiresIn,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: options.key,
      ContentType: options.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      uploadUrl,
      publicUrl: this.resolvePublicUrl(options.key),
      key: options.key,
      expiresIn,
    };
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresInSeconds: number = 3600,
  ): Promise<PresignedDownloadUrlResponse> {
    if (!this.isConfigured || !this.s3Client) {
      return {
        downloadUrl: `${this.publicUrl}/${key}`,
        key,
        expiresIn: expiresInSeconds,
      };
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      downloadUrl,
      key,
      expiresIn: expiresInSeconds,
    };
  }

  getPublicUrl(storageReference: string): string {
    const objectKey = this.getObjectKey(storageReference);

    return objectKey ? this.resolvePublicUrl(objectKey) : storageReference;
  }

  getObjectKey(storageReference: string | null | undefined): string | null {
    if (!storageReference) return null;

    const normalizedReference = storageReference.trim();

    if (!normalizedReference) return null;

    if (/^https?:\/\//i.test(normalizedReference)) {
      const configuredStorageKey =
        this.getKeyFromPublicUrl(normalizedReference);

      if (configuredStorageKey) return configuredStorageKey;

      try {
        const pathname = decodeURIComponent(
          new URL(normalizedReference).pathname,
        );
        const knownFolderMatch = pathname.match(
          /\/(listings|avatars)\/([^?#]+)/,
        );

        if (!knownFolderMatch) return null;

        const legacyKey = `${knownFolderMatch[1]}/${knownFolderMatch[2]}`;

        return legacyKey.includes('..') || legacyKey.includes('\\')
          ? null
          : legacyKey;
      } catch {
        return null;
      }
    }

    const key = normalizedReference.replace(/^\/+/, '');

    if (!key || key.includes('..') || key.includes('\\')) return null;

    return key;
  }

  getKeyFromPublicUrl(publicUrl: string): string | null {
    const normalizedBaseUrl = this.publicUrl.replace(/\/$/, '');

    if (normalizedBaseUrl && publicUrl.startsWith(`${normalizedBaseUrl}/`)) {
      return decodeURIComponent(publicUrl.slice(normalizedBaseUrl.length + 1));
    }

    try {
      const parsedUrl = new URL(publicUrl);
      const defaultR2Host = `${this.bucketName}.r2.cloudflarestorage.com`;

      if (parsedUrl.hostname !== defaultR2Host) return null;

      return decodeURIComponent(parsedUrl.pathname.replace(/^\//, '')) || null;
    } catch {
      return null;
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    if (!this.isConfigured || !this.s3Client) {
      this.logger.log(`Mock delete file key: ${key}`);

      return true;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      return true;
    } catch (error) {
      this.logger.error(`Error deleting file from R2: ${key}`, error);

      return false;
    }
  }

  async assertValidImageObject(key: string): Promise<void> {
    if (!this.isConfigured || !this.s3Client) return;

    try {
      const head = await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      const contentType = head.ContentType?.toLowerCase() ?? '';
      const contentLength = head.ContentLength ?? 0;
      const isAllowedType = (
        STORAGE_LIMITS.ALLOWED_IMAGE_TYPES as readonly string[]
      ).includes(contentType);

      if (isAllowedType && contentLength <= STORAGE_LIMITS.MAX_IMAGE_BYTES) {
        return;
      }

      await this.deleteFile(key);
    } catch {
      throw new BadRequestException('Không tìm thấy ảnh đã tải lên');
    }

    throw new BadRequestException(
      'Ảnh phải là jpg hoặc png và có dung lượng tối đa 100MB',
    );
  }

  async objectExists(key: string): Promise<boolean> {
    if (!this.isConfigured || !this.s3Client) {
      return true;
    }

    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      return true;
    } catch {
      return false;
    }
  }
}

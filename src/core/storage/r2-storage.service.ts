import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
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
    fileName: string,
    contentType: string,
    folder: string = 'listings',
  ): Promise<PresignedUploadUrlResponse> {
    const rawExt = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';
    const sanitizedExt =
      rawExt?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
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
      expiresInSeconds: 900,
    });
  }

  async getPresignedUploadUrl(
    options: PresignedUploadUrlOptions,
  ): Promise<PresignedUploadUrlResponse> {
    const expiresIn = options.expiresInSeconds ?? 900;

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

  getPublicUrl(key: string): string {
    return this.resolvePublicUrl(key);
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

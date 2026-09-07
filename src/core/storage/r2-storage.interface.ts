export interface PresignedUploadUrlOptions {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedUploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

export interface PresignedDownloadUrlResponse {
  downloadUrl: string;
  key: string;
  expiresIn: number;
}

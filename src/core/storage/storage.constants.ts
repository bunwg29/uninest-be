export const STORAGE_LIMITS = {
  PRESIGN_EXPIRES_SECONDS: 5 * 60,
  MAX_IMAGE_BYTES: 100 * 1024 * 1024,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png'],
  MAX_VIDEO_BYTES: 100 * 1024 * 1024,
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime'],
  VIDEO_FOLDERS: ['listings', 'forum'],
} as const;

export const DEMO_SEED_IMAGE_PREFIX = 'listings/seed-assets/v1/';

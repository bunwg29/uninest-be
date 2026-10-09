import { DEMO_SEED_IMAGE_PREFIX } from '@core/storage/storage.constants';

export const DEMO_ASSET_COUNT = 400;

export const DEMO_ASSET_SEARCH_QUERIES = [
  'bedroom interior',
  'small bedroom',
  'studio apartment',
  'cozy bedroom',
  'minimalist bedroom',
  'dormitory room',
  'apartment interior',
  'apartment living room',
] as const;

export const DEMO_ASSETS = Array.from(
  { length: DEMO_ASSET_COUNT },
  (_, index) => ({
    key: `${DEMO_SEED_IMAGE_PREFIX}room-${String(index + 1).padStart(3, '0')}.jpg`,
  }),
);

import { DEMO_SEED_IMAGE_PREFIX } from '@core/storage/storage.constants';

const PHOTO_IDS = [
  'photo-1579632151052-92f741fb9b79',
  'photo-1570570665905-346e1b6be193',
  'photo-1552189864-e05b02af1697',
  'photo-1543607875-4d92312234c5',
  'photo-1560448075-57d0285fc59b',
  'photo-1612320743558-020669ff20e8',
  'photo-1616486338812-3dadae4b4ace',
  'photo-1616594039964-ae9021a400a0',
  'photo-1618221195710-dd6b41faaea6',
  'photo-1505693416388-ac5ce068fe85',
  'photo-1615874959474-d609969a20ed',
  'photo-1522708323590-d24dbb6b0267',
] as const;

export const DEMO_ASSETS = PHOTO_IDS.map((photoId, index) => ({
  key: `${DEMO_SEED_IMAGE_PREFIX}room-${String(index + 1).padStart(2, '0')}.jpg`,
  sourceUrl: `https://images.unsplash.com/${photoId}?w=800&q=80&fm=jpg`,
}));

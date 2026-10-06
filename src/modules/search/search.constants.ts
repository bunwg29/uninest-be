export const SEARCH_SORT_VALUES = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'area_asc',
  'area_desc',
  'distance',
] as const;

export type SearchSort = (typeof SEARCH_SORT_VALUES)[number];

export const SEARCH_ROOM_TYPE_VALUES = [
  'phong_tro',
  'nha_nguyen_can',
  'chung_cu_mini',
  'ky_tuc_xa',
  'studio',
  'can_ho_dich_vu',
] as const;

export type SearchRoomType = (typeof SEARCH_ROOM_TYPE_VALUES)[number];

export const SEARCH_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 50,
  RADIUS_KM: 5,
  MAX_RADIUS_KM: 50,
  MAX_KEYWORD_LENGTH: 100,
  MAX_AMENITY_FILTERS: 32,
} as const;

export const SEARCH_ROOM_TYPE_DATABASE_VALUES: Record<
  SearchRoomType,
  readonly string[]
> = {
  phong_tro: [
    'phong_tro',
    'phong_don_co_ban',
    'phong_don_wc_rieng',
    'phong_gac_lung',
    'phong_may_lanh',
  ],
  nha_nguyen_can: ['nha_nguyen_can'],
  chung_cu_mini: ['chung_cu_mini'],
  ky_tuc_xa: ['ky_tuc_xa'],
  studio: ['studio', 'studio_mini'],
  can_ho_dich_vu: ['can_ho_dich_vu'],
};

export const SEARCH_ROOM_TYPE_RESPONSE_VALUES: Readonly<
  Record<string, SearchRoomType>
> = {
  phong_tro: 'phong_tro',
  phong_don_co_ban: 'phong_tro',
  phong_don_wc_rieng: 'phong_tro',
  phong_gac_lung: 'phong_tro',
  phong_may_lanh: 'phong_tro',
  nha_nguyen_can: 'nha_nguyen_can',
  chung_cu_mini: 'chung_cu_mini',
  ky_tuc_xa: 'ky_tuc_xa',
  studio: 'studio',
  studio_mini: 'studio',
  can_ho_dich_vu: 'can_ho_dich_vu',
};

export const SEARCH_LISTING_GEOGRAPHY_SQL = 'listing.location::geography';

export const SEARCH_REFERENCE_POINT_SQL =
  'ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography';

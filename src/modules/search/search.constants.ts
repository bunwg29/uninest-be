export const SEARCH_SORT_VALUES = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'area_asc',
  'area_desc',
  'nearest',
] as const;

export type SearchSort = (typeof SEARCH_SORT_VALUES)[number];

export const SEARCH_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 50,
  RADIUS_KM: 5,
  MAX_RADIUS_KM: 50,
  MAX_KEYWORD_LENGTH: 100,
  MAX_AMENITY_FILTERS: 32,
  MAX_UNIVERSITY_FILTERS: 5,
} as const;

export const SEARCH_LISTING_GEOGRAPHY_SQL = 'listing.location::geography';

export const SEARCH_REFERENCE_POINT_SQL =
  'ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography';

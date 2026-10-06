import { BadRequestException, Injectable } from '@nestjs/common';
import { SearchListingsQueryDto, SearchListingsResponseDto } from './dto';
import {
  SEARCH_DEFAULTS,
  SearchRoomType,
  SearchSort,
} from './search.constants';
import { ListingsSearchRepository } from './search.repository';

export interface NormalizedSearchQuery {
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  roomTypes: SearchRoomType[];
  amenities: number[];
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sortBy: SearchSort;
  page: number;
  limit: number;
}

export const normalizeSearchQuery = (
  query: SearchListingsQueryDto,
): NormalizedSearchQuery => {
  const hasLatitude = query.latitude !== undefined;
  const hasLongitude = query.longitude !== undefined;

  if (hasLatitude !== hasLongitude) {
    throw new BadRequestException({
      error: 'INVALID_COORDINATES',
      message: 'Vui lòng cung cấp đầy đủ vĩ độ và kinh độ.',
    });
  }

  if (
    query.minPrice !== undefined &&
    query.maxPrice !== undefined &&
    query.minPrice > query.maxPrice
  ) {
    throw new BadRequestException({
      error: 'INVALID_PRICE_RANGE',
      message: 'Giá tối thiểu không được lớn hơn giá tối đa.',
    });
  }

  if (
    query.minArea !== undefined &&
    query.maxArea !== undefined &&
    query.minArea > query.maxArea
  ) {
    throw new BadRequestException({
      error: 'INVALID_AREA_RANGE',
      message: 'Diện tích tối thiểu không được lớn hơn diện tích tối đa.',
    });
  }

  if (query.sortBy === 'distance' && !hasLatitude) {
    throw new BadRequestException({
      error: 'INVALID_COORDINATES',
      message: 'Cần cung cấp vị trí để sắp xếp theo khoảng cách.',
    });
  }

  return {
    keyword: query.keyword || undefined,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    minArea: query.minArea,
    maxArea: query.maxArea,
    roomTypes: query.roomTypes ?? [],
    amenities: query.amenities ?? [],
    latitude: query.latitude,
    longitude: query.longitude,
    radiusKm: hasLatitude
      ? (query.radius ?? SEARCH_DEFAULTS.RADIUS_KM)
      : undefined,
    sortBy: query.sortBy,
    page: query.page,
    limit: query.limit,
  };
};

@Injectable()
export class SearchService {
  constructor(
    private readonly listingsSearchRepository: ListingsSearchRepository,
  ) {}

  search(query: SearchListingsQueryDto): Promise<SearchListingsResponseDto> {
    const normalizedQuery = normalizeSearchQuery(query);

    return this.listingsSearchRepository.search(normalizedQuery);
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchListingLocationDto {
  @ApiProperty({ example: 16.073 })
  latitude!: number;

  @ApiProperty({ example: 108.149 })
  longitude!: number;
}

export class SearchListingStatsDto {
  @ApiProperty({ example: 0 })
  views!: number;

  @ApiProperty({ example: 0 })
  saved!: number;
}

export class SearchListingItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  thumbnail!: string | null;

  @ApiProperty({ type: [String] })
  imageUrls!: string[];

  @ApiProperty()
  price!: number;

  @ApiProperty()
  area!: number;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  roomType!: string;

  @ApiProperty({ type: [Number] })
  amenityIds!: number[];

  @ApiProperty({ type: SearchListingLocationDto })
  location!: SearchListingLocationDto;

  @ApiPropertyOptional({ nullable: true, description: 'Khoảng cách theo mét' })
  distanceMeters?: number | null;

  @ApiProperty()
  isHighlighted!: boolean;

  @ApiProperty()
  isReserved!: boolean;

  @ApiPropertyOptional()
  capacity?: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ example: 'active' })
  status!: 'active';

  @ApiProperty({ type: SearchListingStatsDto })
  stats!: SearchListingStatsDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class SearchPaginationDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class SearchListingsResponseDto {
  @ApiProperty({ type: [SearchListingItemDto] })
  items!: SearchListingItemDto[];

  @ApiProperty({ type: SearchPaginationDto })
  pagination!: SearchPaginationDto;
}

import { RoomType } from '@modules/listings/entities/room-type';

export interface AiChatCriteria {
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  roomTypes?: RoomType[];
  amenityIds?: number[];
  universityCode?: string;
  provinceCode?: string;
  wardCode?: string;
}

export interface AiCriteriaDisplay {
  labels: string[];
  university: { code: string; name: string } | null;
  province: { code: string; name: string } | null;
  ward: { code: string; name: string } | null;
  amenities: { id: number; name: string }[];
  roomTypes: { value: RoomType; label: string }[];
}

export interface AiRelaxationSuggestion {
  title: string;
  description: string;
  criteria: AiChatCriteria;
  matchedCount: number;
}

export enum AmenityGroup {
  FURNITURE = 0,
  FACILITY = 1,
  SECURITY = 2,
  ROOM_FEATURE = 3,
}

export const AMENITY_GROUP_NAMES: Record<AmenityGroup, string> = {
  [AmenityGroup.FURNITURE]: 'Nội thất',
  [AmenityGroup.FACILITY]: 'Tiện ích',
  [AmenityGroup.SECURITY]: 'An ninh',
  [AmenityGroup.ROOM_FEATURE]: 'Phòng',
};

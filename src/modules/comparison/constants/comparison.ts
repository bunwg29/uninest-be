import { ListingStatus } from '@modules/listings/entities';

export const MAX_COMPARISON_ITEMS = 4;

export const COMPARISON_LOCK_PREFIX = 'comparison:';

export const COMPARISON_ERROR_MESSAGES = {
  LISTING_NOT_FOUND: 'Không tìm thấy tin đăng',
  LISTING_NOT_ACTIVE: 'Tin đăng không còn hiển thị nên không thể so sánh',
  LIMIT_REACHED: `Chỉ so sánh được tối đa ${MAX_COMPARISON_ITEMS} phòng`,
  INVALID_LISTING_ID: 'Mã định danh tin đăng không hợp lệ',
} as const;

export const COMPARISON_UNAVAILABLE_REASONS = {
  DELETED: 'Tin đăng đã bị xoá',
  RENTED: 'Phòng đã được cho thuê',
  PAUSED: 'Tin đăng đang tạm dừng',
  HIDDEN: 'Tin đăng đã bị ẩn',
  DEFAULT: 'Tin đăng không còn hiển thị',
} as const;

export const COMPARISON_STATUS_REASONS: Partial<Record<ListingStatus, string>> =
  {
    [ListingStatus.RENTED]: COMPARISON_UNAVAILABLE_REASONS.RENTED,
    [ListingStatus.PAUSED]: COMPARISON_UNAVAILABLE_REASONS.PAUSED,
    [ListingStatus.HIDDEN]: COMPARISON_UNAVAILABLE_REASONS.HIDDEN,
  };

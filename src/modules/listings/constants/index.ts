export const LISTING_EVENTS = {
  AVAILABILITY_CHANGED: 'listing.availability_changed',
  ACTIVATED: 'listing.activated',
  REVIEWED: 'listing.reviewed',
} as const;

export interface ListingAvailabilityChangedPayload {
  listingId: string;
}

export interface ListingActivatedPayload {
  listingId: string;
}

export interface ListingReviewedPayload {
  listingId: string;
  ownerId: string;
  status: 'active' | 'rejected';
  reason?: string;
  auditId: string;
}

export const LISTING_EVENTS = {
  AVAILABILITY_CHANGED: 'listing.availability_changed',
  ACTIVATED: 'listing.activated',
} as const;

export interface ListingAvailabilityChangedPayload {
  listingId: string;
}

export interface ListingActivatedPayload {
  listingId: string;
}

export const LISTING_EVENTS = {
  AVAILABILITY_CHANGED: 'listing.availability_changed',
} as const;

export interface ListingAvailabilityChangedPayload {
  listingId: string;
}

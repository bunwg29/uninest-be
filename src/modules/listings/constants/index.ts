import { ListingStatus } from '../entities/listing-status';

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
  status: ListingStatus.ACTIVE | ListingStatus.REJECTED | ListingStatus.HIDDEN;
  reason?: string;
  auditId: string;
}

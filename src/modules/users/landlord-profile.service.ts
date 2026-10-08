import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRoleType } from '@common/constants';
import { R2StorageService } from '@core/storage';
import { Booking } from '@modules/booking/entities';
import { Conversation } from '@modules/chat/entities';
import { Listing, ListingStatus } from '@modules/listings/entities';
import { User } from './entities/user';
import { LandlordPublicProfileDto } from './dtos';

@Injectable()
export class LandlordProfileService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly storageService: R2StorageService,
  ) {}

  async getPublicProfile(
    viewerId: string,
    landlordId: string,
  ): Promise<LandlordPublicProfileDto> {
    const landlord = await this.dataSource.getRepository(User).findOne({
      where: { id: landlordId, roleId: UserRoleType.LANDLORD, isActive: true },
    });

    if (!landlord) {
      throw new NotFoundException('Không tìm thấy chủ trọ');
    }

    const [activeListingCount, canSeePhone] = await Promise.all([
      this.dataSource.getRepository(Listing).countBy({
        ownerId: landlordId,
        status: ListingStatus.ACTIVE,
      }),
      this.canSeePhone(viewerId, landlordId),
    ]);

    return {
      id: landlord.id,
      fullName: landlord.fullName,
      avatarUrl: landlord.avatarUrl
        ? this.storageService.getPublicUrl(landlord.avatarUrl)
        : null,
      isVerified: landlord.landlordVerifiedAt !== null,
      joinedAt: landlord.createdAt,
      bio: landlord.bio,
      activeListingCount,
      phone: canSeePhone ? landlord.phone : null,
      averageRating: null,
      reviewCount: 0,
      responseMinutes: null,
    };
  }

  private async canSeePhone(
    viewerId: string,
    landlordId: string,
  ): Promise<boolean> {
    if (viewerId === landlordId) {
      return true;
    }

    const [hasConversation, hasBooking] = await Promise.all([
      this.dataSource
        .getRepository(Conversation)
        .existsBy({ studentId: viewerId, landlordId }),
      this.dataSource
        .getRepository(Booking)
        .createQueryBuilder('booking')
        .innerJoin(Listing, 'listing', 'listing.id = booking.listingId')
        .where('booking.userId = :viewerId', { viewerId })
        .andWhere('listing.ownerId = :landlordId', { landlordId })
        .getExists(),
    ]);

    return hasConversation || hasBooking;
  }
}

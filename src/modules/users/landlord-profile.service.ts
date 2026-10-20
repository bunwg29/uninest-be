import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRoleType } from '@common/constants';
import { R2StorageService } from '@core/storage';
import { Booking } from '@modules/booking/entities';
import { Conversation } from '@modules/chat/entities';
import {
  Listing,
  ListingStatus,
  ListingUniversity,
} from '@modules/listings/entities';
import { User } from './entities/user';
import { LandlordPublicProfileDto } from './dtos';

const LANDLORD_PROFILE_UNIVERSITY_LIMIT = 5;

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

    const [activeListingCount, canSeePhone, universities] = await Promise.all([
      this.dataSource.getRepository(Listing).countBy({
        ownerId: landlordId,
        status: ListingStatus.ACTIVE,
      }),
      this.canSeePhone(viewerId, landlordId),
      this.findListingUniversities(landlordId),
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
      universities,
      activeListingCount,
      phone: canSeePhone ? landlord.phone : null,
      averageRating: null,
      reviewCount: 0,
      responseMinutes: null,
    };
  }

  private async findListingUniversities(landlordId: string) {
    const rows = await this.dataSource
      .getRepository(ListingUniversity)
      .createQueryBuilder('listingUniversity')
      .innerJoin('listingUniversity.listing', 'listing')
      .innerJoin('listingUniversity.university', 'university')
      .select('university.code', 'code')
      .addSelect('university.name', 'name')
      .addSelect('COUNT(*)', 'total')
      .where('listing.ownerId = :landlordId', { landlordId })
      .andWhere('listing.status = :status', { status: ListingStatus.ACTIVE })
      .andWhere('listing.deletedAt IS NULL')
      .groupBy('university.code')
      .addGroupBy('university.name')
      .orderBy('total', 'DESC')
      .addOrderBy('university.name', 'ASC')
      .limit(LANDLORD_PROFILE_UNIVERSITY_LIMIT)
      .getRawMany<{ code: string; name: string }>();

    return rows.map(({ code, name }) => ({ code, name }));
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

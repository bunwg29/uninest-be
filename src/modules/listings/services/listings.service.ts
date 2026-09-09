import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Province, Ward } from '@modules/locations/entities';
import {
  Amenity,
  Listing,
  ListingAmenity,
  ListingImage,
  ListingStatus,
} from '../entities';
import { CreateListingDto } from '../dtos';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Amenity)
    private readonly amenityRepository: Repository<Amenity>,
    @InjectRepository(Province)
    private readonly provinceRepository: Repository<Province>,
    @InjectRepository(Ward)
    private readonly wardRepository: Repository<Ward>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createListing(userId: string, dto: CreateListingDto): Promise<Listing> {
    const province = await this.provinceRepository.findOneBy({
      code: dto.provinceCode,
    });

    if (!province) {
      throw new NotFoundException('Không tìm thấy tỉnh/thành phố');
    }

    const ward = await this.wardRepository.findOneBy({ code: dto.wardCode });

    if (!ward) {
      throw new NotFoundException('Không tìm thấy phường/xã');
    }

    if (ward.provinceCode !== province.code) {
      throw new BadRequestException(
        'Phường/xã không thuộc tỉnh/thành phố đã chọn',
      );
    }

    const amenityIds = [...new Set(dto.amenityIds ?? [])];
    const amenities = amenityIds.length
      ? await this.amenityRepository.findBy({ id: In(amenityIds) })
      : [];

    if (amenities.length !== amenityIds.length) {
      throw new NotFoundException('Một hoặc nhiều tiện ích không tồn tại');
    }

    if (amenities.some((amenity) => !amenity.isActive)) {
      throw new BadRequestException(
        'Một hoặc nhiều tiện ích đã bị vô hiệu hóa',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const listing = manager.create(Listing, {
        ownerId: userId,
        title: dto.title,
        description: dto.description ?? null,
        roomType: dto.roomType,
        price: String(dto.price),
        area: String(dto.area),
        maxOccupants: dto.maxOccupants,
        electricPrice:
          dto.electricPrice === undefined ? null : String(dto.electricPrice),
        waterPrice:
          dto.waterPrice === undefined ? null : String(dto.waterPrice),
        deposit: dto.deposit === undefined ? null : String(dto.deposit),
        streetAddress: dto.streetAddress,
        provinceCode: province.code,
        wardCode: ward.code,
        fullAddress: `${dto.streetAddress}, ${ward.fullName}, ${province.fullName}`,
        location: {
          type: 'Point',
          coordinates: [dto.longitude, dto.latitude],
        },
        status: ListingStatus.PENDING,
      });

      const savedListing = await manager.save(Listing, listing);

      if (dto.images?.length) {
        const coverCount = dto.images.filter((image) => image.isCover).length;

        if (coverCount > 1) {
          throw new BadRequestException('Tin đăng chỉ được có một ảnh bìa');
        }

        const hasCover = coverCount === 1;
        const images = dto.images.map((image, index) =>
          manager.create(ListingImage, {
            listingId: savedListing.id,
            url: image.url,
            isCover: hasCover ? image.isCover === true : index === 0,
            sortOrder: index,
          }),
        );

        await manager.save(ListingImage, images);
      }

      if (amenities.length) {
        const listingAmenities = amenities.map((amenity) =>
          manager.create(ListingAmenity, {
            listingId: savedListing.id,
            amenityId: amenity.id,
          }),
        );

        await manager.save(ListingAmenity, listingAmenities);
      }

      const createdListing = await manager.findOne(Listing, {
        where: { id: savedListing.id },
        relations: {
          images: true,
          listingAmenities: { amenity: true },
        },
      });

      if (!createdListing) {
        throw new NotFoundException('Không tìm thấy tin đăng vừa tạo');
      }

      return createdListing;
    });
  }
}

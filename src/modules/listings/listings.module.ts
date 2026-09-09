import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Province, Ward } from '@modules/locations/entities';
import { Amenity, Listing, ListingAmenity, ListingImage } from './entities';
import { ListingsController } from './controllers/listings.controller';
import { ListingsService } from './services/listings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Listing,
      ListingImage,
      Amenity,
      ListingAmenity,
      Province,
      Ward,
    ]),
  ],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}

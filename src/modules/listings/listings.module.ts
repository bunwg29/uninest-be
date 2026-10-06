import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Province, Ward } from '@modules/locations/entities';
import {
  Amenity,
  Favorite,
  Listing,
  ListingAmenity,
  ListingImage,
} from './entities';
import { ListingsController } from './controllers/listings.controller';
import { LandlordListingsController } from './controllers/landlord-listings.controller';
import { RoomsController } from './controllers/rooms.controller';
import { ListingsService } from './services/listings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Listing,
      ListingImage,
      Amenity,
      Favorite,
      ListingAmenity,
      Province,
      Ward,
    ]),
  ],
  controllers: [
    ListingsController,
    LandlordListingsController,
    RoomsController,
  ],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}

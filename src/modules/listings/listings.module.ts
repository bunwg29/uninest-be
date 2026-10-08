import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UniversitiesModule } from '@modules/universities/universities.module';
import { Province, Ward } from '@modules/locations/entities';
import {
  Amenity,
  Favorite,
  Listing,
  ListingAmenity,
  ListingUniversity,
  ListingImage,
  ListingReport,
  ListingView,
} from './entities';
import { ListingsController } from './controllers/listings.controller';
import { LandlordListingsController } from './controllers/landlord-listings.controller';
import { ListingsService } from './services/listings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Listing,
      ListingImage,
      Amenity,
      Favorite,
      ListingAmenity,
      ListingUniversity,
      ListingReport,
      ListingView,
      Province,
      Ward,
    ]),
    UniversitiesModule,
  ],
  controllers: [ListingsController, LandlordListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}

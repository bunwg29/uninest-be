import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '@modules/listings/entities';
import { ListingsModule } from '@modules/listings/listings.module';
import { ComparisonController } from './controllers/comparison.controller';
import { ComparisonItem } from './entities';
import { ComparisonService } from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComparisonItem, Listing]),
    ListingsModule,
  ],
  controllers: [ComparisonController],
  providers: [ComparisonService],
  exports: [ComparisonService],
})
export class ComparisonModule {}

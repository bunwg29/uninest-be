import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceAggregate } from './entities';
import { PriceComparisonController } from './price-comparison.controller';
import { PriceAggregationService, PriceComparisonService } from './services';

@Module({
  imports: [TypeOrmModule.forFeature([PriceAggregate])],
  controllers: [PriceComparisonController],
  providers: [PriceAggregationService, PriceComparisonService],
  exports: [PriceAggregationService, PriceComparisonService],
})
export class PriceComparisonModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from '@modules/listings/entities';
import { SearchController } from './search.controller';
import { ListingsSearchRepository } from './search.repository';
import { SearchService } from './search.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [SearchController],
  providers: [ListingsSearchRepository, SearchService],
  exports: [SearchService],
})
export class SearchModule {}

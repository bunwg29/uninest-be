import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { University, UserUniversity } from './entities';
import { UniversitiesController } from './universities.controller';
import { UniversitiesService } from './universities.service';

@Module({
  imports: [TypeOrmModule.forFeature([University, UserUniversity])],
  controllers: [UniversitiesController],
  providers: [UniversitiesService],
  exports: [UniversitiesService],
})
export class UniversitiesModule {}

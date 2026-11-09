import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@modules/users/entities';
import { PremiumController } from './premium.controller';
import {
  PremiumExpiryService,
  PremiumService,
  PremiumStatsService,
} from './services';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [PremiumController],
  providers: [PremiumService, PremiumExpiryService, PremiumStatsService],
  exports: [PremiumService],
})
export class PremiumModule {}

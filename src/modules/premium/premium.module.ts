import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@modules/users/entities';
import { PremiumPlan } from './entities';
import { PremiumController } from './premium.controller';
import {
  PremiumExpiryService,
  PremiumService,
  PremiumStatsService,
} from './services';

@Module({
  imports: [TypeOrmModule.forFeature([User, PremiumPlan])],
  controllers: [PremiumController],
  providers: [PremiumService, PremiumExpiryService, PremiumStatsService],
  exports: [PremiumService],
})
export class PremiumModule {}

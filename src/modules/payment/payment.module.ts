import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PremiumModule } from '@modules/premium';
import { PremiumOrder } from './entities';
import { PaymentController } from './payment.controller';
import { PremiumOrderService } from './services';

@Module({
  imports: [TypeOrmModule.forFeature([PremiumOrder]), PremiumModule],
  controllers: [PaymentController],
  providers: [PremiumOrderService],
  exports: [PremiumOrderService],
})
export class PaymentModule {}

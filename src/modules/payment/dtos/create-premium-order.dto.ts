import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { PREMIUM_PLAN_CODES, type PremiumPlanCode } from '@modules/premium';

export class CreatePremiumOrderDto {
  @ApiProperty({ enum: PREMIUM_PLAN_CODES, example: '1m' })
  @IsIn(PREMIUM_PLAN_CODES, { message: 'Gói Premium không hợp lệ' })
  planCode!: PremiumPlanCode;
}

import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class SepayWebhookDto {
  @IsNumber()
  id!: number;

  @IsIn(['in', 'out'])
  transferType!: 'in' | 'out';

  @IsNumber()
  transferAmount!: number;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsString()
  gateway?: string | null;

  @IsOptional()
  @IsString()
  transactionDate?: string | null;

  @IsOptional()
  @IsString()
  accountNumber?: string | null;

  @IsOptional()
  @IsString()
  subAccount?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  referenceCode?: string | null;

  @IsOptional()
  @IsNumber()
  accumulated?: number | null;
}

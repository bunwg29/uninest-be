import { timingSafeEqual } from 'crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@common/constants';
import { CurrentUser, Public, Roles } from '@common/decorators';
import { JwtAuthGuard, RolesGuard } from '@common/guards';
import { CreatePremiumOrderDto, SepayWebhookDto } from './dtos';
import { PremiumOrderService } from './services';

@ApiTags('Thanh toán')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly premiumOrderService: PremiumOrderService,
    private readonly configService: ConfigService,
  ) {}

  @Post('premium/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo đơn mua gói Premium và mã QR chuyển khoản' })
  createOrder(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePremiumOrderDto,
  ) {
    return this.premiumOrderService.createOrder(userId, dto.planCode);
  }

  @Get('premium/orders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleType.LANDLORD)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tra cứu trạng thái đơn mua gói Premium' })
  getOrder(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.premiumOrderService.getOrder(userId, id);
  }

  @Post('sepay/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook xác nhận giao dịch từ SePay' })
  async handleSepayWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: SepayWebhookDto,
  ) {
    this.assertSepayAuthorized(authorization);

    if (dto.transferType === 'in') {
      await this.premiumOrderService.handleSepayTransfer({
        transactionId: String(dto.id),
        amount: dto.transferAmount,
        text: `${dto.code ?? ''} ${dto.content ?? ''} ${dto.description ?? ''}`,
      });
    }

    return { success: true };
  }

  private assertSepayAuthorized(authorization: string | undefined): void {
    const apiKey = this.configService.get<string>('SEPAY_API_KEY');
    const expected = Buffer.from(`Apikey ${apiKey ?? ''}`);
    const received = Buffer.from(authorization ?? '');

    if (
      !apiKey ||
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('Webhook không hợp lệ');
    }
  }
}

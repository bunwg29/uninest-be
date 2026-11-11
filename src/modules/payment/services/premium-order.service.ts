import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import {
  PREMIUM_EVENTS,
  PremiumService,
  type PremiumActivatedPayload,
  type PremiumPlanCode,
} from '@modules/premium';
import { PAYMENT_DEFAULTS, REFERENCE_PATTERN } from '../constants';
import { PremiumOrder, PremiumOrderStatus } from '../entities';

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class PremiumOrderService {
  private readonly logger = new Logger(PremiumOrderService.name);

  constructor(
    @InjectRepository(PremiumOrder)
    private readonly orderRepository: Repository<PremiumOrder>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly premiumService: PremiumService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createOrder(userId: string, planCode: PremiumPlanCode) {
    const bankAccount = this.configService.get<string>('SEPAY_BANK_ACCOUNT');
    const bankCode = this.configService.get<string>('SEPAY_BANK_CODE');

    if (!bankAccount || !bankCode) {
      throw new ServiceUnavailableException({
        error: 'PAYMENT_NOT_CONFIGURED',
        message: 'Cổng thanh toán chưa sẵn sàng. Vui lòng thử lại sau.',
      });
    }

    const plan = await this.premiumService.findActivePlan(planCode);

    if (!plan) {
      throw new BadRequestException(
        'Gói Premium không tồn tại hoặc đang tạm ngưng',
      );
    }

    const order = await this.orderRepository.save(
      this.orderRepository.create({
        userId,
        planCode: plan.code,
        months: plan.months,
        amount: plan.price,
        referenceCode: this.generateReference(),
        status: PremiumOrderStatus.PENDING,
        expiresAt: new Date(
          Date.now() + PAYMENT_DEFAULTS.ORDER_EXPIRES_MINUTES * 60_000,
        ),
      }),
    );

    return this.toResponse(order);
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.orderRepository.findOneBy({ id: orderId, userId });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn thanh toán');
    }

    return this.toResponse(order);
  }

  async handleSepayTransfer(input: {
    transactionId: string;
    amount: number;
    text: string;
  }): Promise<void> {
    const match = REFERENCE_PATTERN.exec(input.text.toUpperCase());

    if (!match) {
      return;
    }

    const activated = await this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(PremiumOrder).findOne({
        where: { referenceCode: match[0] },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order || order.status === PremiumOrderStatus.PAID) {
        return null;
      }

      if (input.amount < order.amount) {
        this.logger.warn(
          `SePay transfer ${input.transactionId} for ${order.referenceCode} is below the order amount`,
        );

        return null;
      }

      const expiresAt = await this.premiumService.activate(
        manager,
        order.userId,
        order.months,
      );

      await manager.getRepository(PremiumOrder).update(
        { id: order.id },
        {
          status: PremiumOrderStatus.PAID,
          gatewayTransactionId: input.transactionId,
          paidAt: new Date(),
        },
      );

      const payload: PremiumActivatedPayload = {
        userId: order.userId,
        expiresAt,
        orderId: order.id,
      };

      return payload;
    });

    if (activated) {
      this.eventEmitter.emit(PREMIUM_EVENTS.ACTIVATED, activated);
    }
  }

  @Cron(PAYMENT_DEFAULTS.SWEEP_CRON_EXPRESSION)
  async expirePendingOrders(): Promise<void> {
    await this.orderRepository.update(
      {
        status: PremiumOrderStatus.PENDING,
        expiresAt: LessThanOrEqual(new Date()),
      },
      { status: PremiumOrderStatus.EXPIRED },
    );
  }

  private generateReference(): string {
    const bytes = randomBytes(PAYMENT_DEFAULTS.REFERENCE_LENGTH);
    const suffix = Array.from(
      bytes,
      (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
    ).join('');

    return `${PAYMENT_DEFAULTS.REFERENCE_PREFIX}${suffix}`;
  }

  private toResponse(order: PremiumOrder) {
    const bankAccount = this.configService.get<string>('SEPAY_BANK_ACCOUNT');
    const bankCode = this.configService.get<string>('SEPAY_BANK_CODE');
    const accountName = this.configService.get<string>('SEPAY_ACCOUNT_NAME');
    const params = new URLSearchParams({
      acc: bankAccount ?? '',
      bank: bankCode ?? '',
      amount: String(order.amount),
      des: order.referenceCode,
    });
    const expired =
      order.status === PremiumOrderStatus.PENDING &&
      order.expiresAt.getTime() <= Date.now();

    return {
      id: order.id,
      planCode: order.planCode,
      months: order.months,
      amount: order.amount,
      status: expired ? PremiumOrderStatus.EXPIRED : order.status,
      referenceCode: order.referenceCode,
      expiresAt: order.expiresAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      qrUrl: `${PAYMENT_DEFAULTS.QR_BASE_URL}?${params.toString()}`,
      bankAccount: bankAccount ?? null,
      bankCode: bankCode ?? null,
      accountName: accountName ?? null,
    };
  }
}

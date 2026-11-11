import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { PremiumPlan } from '@modules/premium/entities';
import { UpdatePremiumPlanDto } from '../dtos';
import { AdminAuditService } from './admin-audit.service';

const formatVnd = (amount: number): string =>
  `${amount.toLocaleString('vi-VN')}đ`;

@Injectable()
export class AdminPremiumPlansService {
  constructor(
    @InjectRepository(PremiumPlan)
    private readonly repository: Repository<PremiumPlan>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AdminAuditService,
  ) {}

  async list() {
    const plans = await this.repository.find({ order: { sortOrder: 'ASC' } });

    return plans.map((plan) => this.toResponse(plan));
  }

  async update(actorId: string, code: string, dto: UpdatePremiumPlanDto) {
    if (
      dto.name === undefined &&
      dto.price === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException('Không có thay đổi nào để lưu');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const plan = await manager.getRepository(PremiumPlan).findOne({
        where: { code },
        lock: { mode: 'pessimistic_write' },
      });

      if (!plan) {
        throw new NotFoundException('Không tìm thấy gói Premium');
      }

      const changes: string[] = [];

      if (dto.name !== undefined && dto.name.trim() !== plan.name) {
        changes.push(`tên "${plan.name}" → "${dto.name.trim()}"`);
        plan.name = dto.name.trim();
      }

      if (dto.price !== undefined && dto.price !== plan.price) {
        changes.push(`giá ${formatVnd(plan.price)} → ${formatVnd(dto.price)}`);
        plan.price = dto.price;
      }

      if (dto.isActive !== undefined && dto.isActive !== plan.isActive) {
        changes.push(dto.isActive ? 'bật gói' : 'tắt gói');
        plan.isActive = dto.isActive;
      }

      if (changes.length === 0) {
        return plan;
      }

      const otherActiveCount = await manager.getRepository(PremiumPlan).count({
        where: { isActive: true, code: Not(code) },
      });

      if (!plan.isActive && otherActiveCount < 1) {
        throw new BadRequestException('Phải có ít nhất một gói đang bật');
      }

      const saved = await manager.getRepository(PremiumPlan).save(plan);

      await this.auditService.record(
        manager,
        actorId,
        'premium_plan.update',
        'premium_plan',
        saved.id,
        `Gói ${saved.code}: ${changes.join(', ')}`.slice(0, 500),
      );

      return saved;
    });

    return this.toResponse(updated);
  }

  private toResponse(plan: PremiumPlan) {
    return {
      code: plan.code,
      name: plan.name,
      months: plan.months,
      price: plan.price,
      isActive: plan.isActive,
      updatedAt: plan.updatedAt,
    };
  }
}

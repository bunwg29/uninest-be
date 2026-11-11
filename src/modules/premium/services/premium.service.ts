import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from '@modules/users/entities';
import { PremiumPlan } from '../entities';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export interface PremiumStatus {
  isPremium: boolean;
  expiresAt: string | null;
  daysRemaining: number;
}

@Injectable()
export class PremiumService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PremiumPlan)
    private readonly planRepository: Repository<PremiumPlan>,
  ) {}

  async getPlans() {
    const plans = await this.planRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    return plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      months: plan.months,
      price: plan.price,
      unit: 'VNĐ',
    }));
  }

  findActivePlan(code: string): Promise<PremiumPlan | null> {
    return this.planRepository.findOneBy({ code, isActive: true });
  }

  async getStatus(userId: string): Promise<PremiumStatus> {
    const user = await this.userRepository.findOne({
      select: { id: true, isPremium: true, premiumExpiresAt: true },
      where: { id: userId },
    });

    return this.toStatus(user);
  }

  async assertActive(userId: string): Promise<PremiumStatus> {
    const status = await this.getStatus(userId);

    if (!status.isPremium) {
      throw new ForbiddenException({
        error: 'PREMIUM_REQUIRED',
        message:
          'Tính năng này chỉ dành cho tài khoản Premium còn hiệu lực. Hãy nâng cấp để sử dụng.',
      });
    }

    return status;
  }

  async activate(
    manager: EntityManager,
    userId: string,
    months: number,
  ): Promise<Date> {
    const user = await manager.getRepository(User).findOneOrFail({
      select: { id: true, isPremium: true, premiumExpiresAt: true },
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    const now = new Date();
    const base =
      user.isPremium && user.premiumExpiresAt && user.premiumExpiresAt > now
        ? user.premiumExpiresAt
        : now;
    const expiresAt = new Date(base);

    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months);

    await manager
      .getRepository(User)
      .update({ id: userId }, { isPremium: true, premiumExpiresAt: expiresAt });

    return expiresAt;
  }

  private toStatus(user: User | null): PremiumStatus {
    const expiresAt = user?.premiumExpiresAt ?? null;
    const isPremium =
      !!user?.isPremium &&
      expiresAt !== null &&
      expiresAt.getTime() > Date.now();

    return {
      isPremium,
      expiresAt: isPremium ? expiresAt.toISOString() : null,
      daysRemaining: isPremium
        ? Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MILLISECONDS)
        : 0,
    };
  }
}

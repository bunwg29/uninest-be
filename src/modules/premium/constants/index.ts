export const PREMIUM_PLANS = [
  { code: '1m', name: 'Premium 1 tháng', months: 1, price: 99000 },
  { code: '3m', name: 'Premium 3 tháng', months: 3, price: 269000 },
  { code: '6m', name: 'Premium 6 tháng', months: 6, price: 499000 },
] as const;

export type PremiumPlanCode = (typeof PREMIUM_PLANS)[number]['code'];

export const PREMIUM_PLAN_CODES = PREMIUM_PLANS.map((plan) => plan.code);

export const PREMIUM_DEFAULTS = {
  CRON_EXPRESSION: '0 1 * * *',
  TIME_ZONE: 'Asia/Ho_Chi_Minh',
  REMINDER_DAYS: 3,
} as const;

export const PREMIUM_EVENTS = {
  ACTIVATED: 'premium.activated',
  EXPIRING: 'premium.expiring',
  EXPIRED: 'premium.expired',
} as const;

export interface PremiumActivatedPayload {
  userId: string;
  expiresAt: Date;
  orderId: string;
}

export interface PremiumExpiringPayload {
  userId: string;
  expiresAt: Date;
}

export interface PremiumExpiredPayload {
  userId: string;
  expiredAt: Date;
}

export const PREMIUM_STATS_PERIODS = ['7d', '30d', '90d'] as const;

export type PremiumStatsPeriod = (typeof PREMIUM_STATS_PERIODS)[number];

export const PREMIUM_STATS_PERIOD_DAYS: Record<PremiumStatsPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

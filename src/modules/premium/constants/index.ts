export const PREMIUM_PLAN_CODES = ['1m', '3m', '6m'] as const;

export type PremiumPlanCode = (typeof PREMIUM_PLAN_CODES)[number];

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

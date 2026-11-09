export const PAYMENT_DEFAULTS = {
  ORDER_EXPIRES_MINUTES: 30,
  REFERENCE_PREFIX: 'UNINEST',
  REFERENCE_LENGTH: 8,
  SWEEP_CRON_EXPRESSION: '*/10 * * * *',
  QR_BASE_URL: 'https://qr.sepay.vn/img',
} as const;

export const REFERENCE_PATTERN = /UNINEST[A-Z0-9]{8}/;

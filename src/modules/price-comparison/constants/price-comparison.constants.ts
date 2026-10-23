export const PRICE_COMPARISON_DEFAULTS = {
  MINIMUM_SAMPLE_COUNT: 5,
  CRON_EXPRESSION: '0 2 * * *',
  TIME_ZONE: 'Asia/Ho_Chi_Minh',
  ADVISORY_LOCK_ID: 836_307,
  UNIT: 'VNĐ/tháng',
  INSUFFICIENT_DATA_WARNING: 'Dữ liệu chưa đủ để tham chiếu',
} as const;

export enum PriceAggregateAreaLevel {
  PROVINCE = 'province',
  WARD = 'ward',
}

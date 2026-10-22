import type { ReportEntityType } from '../entities';

export const ADMIN_EVENTS = {
  REPORT_WARNING_ISSUED: 'admin.report_warning_issued',
} as const;

export const ADMIN_REVIEW_SLA_HOURS = 8;

export const ADMIN_OVERVIEW_SERIES_DAYS = 30;

export const ADMIN_TIMEZONE = 'Asia/Ho_Chi_Minh';

export interface ReportWarningIssuedPayload {
  auditId: string;
  userId: string;
  entityType: ReportEntityType;
  entityId: string;
  postId?: string;
  reason: string;
}

import type { ReportEntityType } from '../entities';

export const ADMIN_EVENTS = {
  REPORT_WARNING_ISSUED: 'admin.report_warning_issued',
} as const;

export interface ReportWarningIssuedPayload {
  auditId: string;
  userId: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: string;
}

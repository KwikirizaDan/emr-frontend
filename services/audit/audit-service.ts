/**
 * Audit log service (admin, read-only).
 */

import { getList } from "@/services/http/list-helpers";
import type { AuditLog, Paginated } from "@/services/http/api-types";

export type AuditFilters = {
  entity_type?: string;
  entity_id?: number;
  user_id?: number;
  patient_id?: number;
  action?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
};

export const auditService = {
  list(filters: AuditFilters = {}): Promise<Paginated<AuditLog>> {
    return getList<AuditLog>("/audit-logs", { ...filters });
  },
};
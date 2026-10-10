/**
 * Recycle bin service (admin).
 *
 * The API never hard deletes: `DELETE` marks a row and this service is the only
 * way to see those rows again. Restoring writes a RESTORE entry to the audit
 * log, so the reason argument is optional but encouraged.
 */

import { getList } from "@/services/http/list-helpers";
import { bffRequest } from "@/services/http/bff-client";
import type {
  Paginated,
  RecycleBinEntityType,
  RecycleBinItem,
} from "@/services/http/api-types";

export type RecycleBinFilters = {
  entity_type?: RecycleBinEntityType;
  page?: number;
  per_page?: number;
};

export const recycleBinService = {
  /** List soft deleted records, newest first, optionally filtered by entity type. */
  list(filters: RecycleBinFilters = {}): Promise<Paginated<RecycleBinItem>> {
    return getList<RecycleBinItem>("/recycle-bin", { ...filters });
  },

  /** Restore one record. The route expects a JSON body, so always send one. */
  restore(
    entityType: RecycleBinEntityType,
    entityId: number,
    reason?: string,
  ): Promise<unknown> {
    return bffRequest(`/recycle-bin/${entityType}/${entityId}/restore`, {
      method: "POST",
      body: { reason: reason?.trim() ? reason.trim() : null },
    });
  },
};

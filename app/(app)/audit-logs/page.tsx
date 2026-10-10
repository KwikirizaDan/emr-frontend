/**
 * Audit log route: read-only traceability of recorded system activity.
 */
import { PageHeader } from "@/components/shared/page-header";
import { AuditTable } from "@/features/audit/components/audit-table";

export const metadata = {
  title: "Audit logs",
};

/**
 * Renders the audit log table; visibility is governed by the backend.
 */
export default function AuditLogsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Audit logs"
        description="Read-only traceability of every action recorded by the system."
      />
      <AuditTable />
    </div>
  );
}

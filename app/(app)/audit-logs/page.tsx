import { PageHeader } from "@/components/shared/page-header";
import { AuditTable } from "@/features/audit/components/audit-table";

export const metadata = {
  title: "Audit logs",
};

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

/**
 * Recycle bin route: soft-deleted records that can be restored.
 */
import { PageHeader } from "@/components/shared/page-header";
import { RecycleBinTable } from "@/features/recycle-bin/components/recycle-bin-table";

export const metadata = {
  title: "Recycle bin",
};

/**
 * Renders the recycle bin table.
 */
export default function RecycleBinPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Recycle bin"
        description="Soft-deleted records kept for audit. Restore a record to make it visible again."
      />
      <RecycleBinTable />
    </div>
  );
}

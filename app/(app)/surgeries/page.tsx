/**
 * Surgery list route: schedule operations and track their status.
 */
import { PageHeader } from "@/components/shared/page-header";
import { SurgeriesTable } from "@/features/surgeries/components/surgeries-table";

export const metadata = {
  title: "Surgeries",
};

/**
 * Renders the surgeries table.
 */
export default function SurgeriesPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Surgeries"
        description="Schedule operations and track them through start, completion and cancellation."
      />
      <SurgeriesTable />
    </div>
  );
}

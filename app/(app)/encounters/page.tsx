import { PageHeader } from "@/components/shared/page-header";
import { EncountersTable } from "@/features/encounters/components/encounters-table";

export const metadata = {
  title: "Encounters",
};

export default function EncountersPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Encounters"
        description="Review consultation records and open encounters."
      />
      <EncountersTable />
    </div>
  );
}

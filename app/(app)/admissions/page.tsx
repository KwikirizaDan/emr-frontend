/**
 * Admission list route: admit patients to ward beds and record discharges.
 */
import { PageHeader } from "@/components/shared/page-header";
import { AdmissionsTable } from "@/features/admissions/components/admissions-table";

export const metadata = {
  title: "Admissions",
};

/**
 * Renders the admissions table.
 */
export default function AdmissionsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Admissions"
        description="Admit patients to a ward bed and record their discharge."
      />
      <AdmissionsTable />
    </div>
  );
}

/**
 * Worklist route listing patients who are currently admitted.
 */
import { PageHeader } from "@/components/shared/page-header";
import { InpatientsWorklist } from "@/features/worklists/components/inpatients-worklist";

export const metadata = {
  title: "Inpatients",
};

/**
 * Renders the admitted-patient worklist.
 */
export default function InpatientsWorklistPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Inpatients"
        description="Patients currently admitted, with ward, bed and admission time."
      />
      <InpatientsWorklist />
    </div>
  );
}

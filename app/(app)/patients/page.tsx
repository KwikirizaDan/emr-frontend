import { PageHeader } from "@/components/shared/page-header";
import { PatientsTable } from "@/features/patients/components/patients-table";

export const metadata = {
  title: "Patients",
};

export default function PatientsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Patients"
        description="Search the register by name, MRN, national ID or phone, and manage patient records."
      />
      <PatientsTable />
    </div>
  );
}
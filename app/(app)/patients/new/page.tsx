import { PageHeader } from "@/components/shared/page-header";
import { PatientForm } from "@/features/patients/components/patient-form";

export const metadata = {
  title: "Register patient",
};

export default function NewPatientPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="Register patient"
        description="Create a new patient record. A unique MRN is generated on save."
      />
      <div className="bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <PatientForm />
      </div>
    </div>
  );
}
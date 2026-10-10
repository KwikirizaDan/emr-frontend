import { PageHeader } from "@/components/shared/page-header";
import { EditPatient } from "@/features/patients/components/edit-patient";

export const metadata = {
  title: "Edit patient",
};

export default function EditPatientPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="Edit patient"
        description="Update the patient record. Changes are recorded in the audit log."
      />
      <EditPatient />
    </div>
  );
}
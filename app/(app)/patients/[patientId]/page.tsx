/**
 * Patient detail route: full record and quick actions for one patient.
 */
import { PatientDetail } from "@/features/patients/components/patient-detail";

export const metadata = {
  title: "Patient",
};

/**
 * Renders the patient detail view; the id comes from the route segment.
 */
export default function PatientDetailPage() {
  return <PatientDetail />;
}
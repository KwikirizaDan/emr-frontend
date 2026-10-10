/**
 * Admission detail route: record for a single inpatient stay.
 */
import { AdmissionDetail } from "@/features/admissions/components/admission-detail";

export const metadata = {
  title: "Admission",
};

/**
 * Renders the admission detail view; the id comes from the route segment.
 */
export default function AdmissionDetailPage() {
  return <AdmissionDetail />;
}

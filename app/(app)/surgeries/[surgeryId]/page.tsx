/**
 * Surgery detail route: record for a single operation.
 */
import { SurgeryDetail } from "@/features/surgeries/components/surgery-detail";

export const metadata = {
  title: "Surgery",
};

/**
 * Renders the surgery detail view; the id comes from the route segment.
 */
export default function SurgeryDetailPage() {
  return <SurgeryDetail />;
}

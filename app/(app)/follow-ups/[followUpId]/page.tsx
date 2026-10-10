/**
 * Follow-up detail route: record for a single review appointment.
 */
import { FollowupDetail } from "@/features/followups/components/followup-detail";

export const metadata = {
  title: "Follow-up",
};

/**
 * Renders the follow-up detail view; the id comes from the route segment.
 */
export default function FollowupDetailPage() {
  return <FollowupDetail />;
}

/**
 * Follow-up list route: book and track review appointments.
 */
import { PageHeader } from "@/components/shared/page-header";
import { FollowupsTable } from "@/features/followups/components/followups-table";

export const metadata = {
  title: "Follow-ups",
};

/**
 * Renders the follow-up table.
 */
export default function FollowupsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Follow-ups"
        description="Book and track patients returning for review."
      />
      <FollowupsTable />
    </div>
  );
}

import { PageHeader } from "@/components/shared/page-header";
import { FollowupsWorklist } from "@/features/worklists/components/followups-worklist";

export const metadata = {
  title: "Follow-ups due",
};

export default function FollowupsWorklistPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Follow-ups due"
        description="Appointments that are due within the selected date range."
      />
      <FollowupsWorklist />
    </div>
  );
}

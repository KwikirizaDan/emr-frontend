import { PageHeader } from "@/components/shared/page-header";
import { SurgeriesWorklist } from "@/features/worklists/components/surgeries-worklist";

export const metadata = {
  title: "Today's surgeries",
};

export default function SurgeriesWorklistPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Today's surgeries"
        description="Theatre schedule for the selected day (Africa/Kampala time)."
      />
      <SurgeriesWorklist />
    </div>
  );
}

/**
 * Dashboard route: a read-only operational overview for the current day.
 */
import { CalendarDays } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import {
  DashboardSummary,
  DashboardWorkPanels,
} from "@/features/dashboard/components/dashboard-summary";
import { formatDate } from "@/lib/date";

export const metadata = {
  title: "Dashboard",
};

/**
 * Renders today's summary metrics and work panels; child components fetch their
 * own data within the signed-in user's permissions.
 */
export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Dashboard"
        description="An overview of today's operational work, shown in Africa/Kampala time."
        actions={
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDate(new Date())}
          </span>
        }
      />

      <DashboardSummary />

      <DashboardWorkPanels />
    </div>
  );
}

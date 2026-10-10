/**
 * New follow-up route: schedules a future review appointment.
 */
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { FollowupForm } from "@/features/followups/components/followup-form";

export const metadata = {
  title: "Book follow-up",
};

/**
 * Renders the follow-up booking form.
 */
export default function NewFollowupPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="Book follow-up"
        description="Schedule a future review appointment for a patient."
      />
      <div className="bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <Suspense fallback={<LoadingState rows={4} />}>
          <FollowupForm />
        </Suspense>
      </div>
    </div>
  );
}

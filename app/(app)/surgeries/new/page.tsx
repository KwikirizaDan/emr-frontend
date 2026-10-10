/**
 * Schedule surgery route: book a theatre slot for an admitted patient.
 */
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { SurgeryForm } from "@/features/surgeries/components/surgery-form";

export const metadata = {
  title: "Schedule surgery",
};

/**
 * Renders the surgery scheduling form.
 */
export default function NewSurgeryPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="Schedule surgery"
        description="Book a theatre slot for an admitted patient."
      />
      <div className="bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <Suspense fallback={<LoadingState rows={4} />}>
          <SurgeryForm />
        </Suspense>
      </div>
    </div>
  );
}

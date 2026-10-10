/**
 * New encounter route scoped to a patient, preselected from the URL segment.
 */
import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EncounterForm } from "@/features/encounters/components/encounter-form";

export const metadata = {
  title: "New encounter",
};

/**
 * Resolves the patient id from the route and opens a new encounter for them.
 */
export default async function NewPatientEncounterPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="New encounter"
        description="Open a consultation record for this patient."
      />
      <div className="bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <Suspense fallback={<LoadingState rows={4} />}>
          <EncounterForm patientId={patientId} />
        </Suspense>
      </div>
    </div>
  );
}

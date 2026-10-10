import { Suspense } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { AdmissionForm } from "@/features/admissions/components/admission-form";

export const metadata = {
  title: "Admit patient",
};

export default function NewAdmissionPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="Admit patient"
        description="Assign the patient to a free bed and record the reason for admission."
      />
      <div className="bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <Suspense fallback={<LoadingState rows={4} />}>
          <AdmissionForm />
        </Suspense>
      </div>
    </div>
  );
}

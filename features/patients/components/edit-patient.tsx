// Route component that loads a patient record and renders the prefilled edit form.
"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PatientForm } from "@/features/patients/components/patient-form";
import { patientService } from "@/services/patients/patient-service";

/** Loads the record, then renders the prefilled edit form. */
export function EditPatient() {
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId;
  const { data: patient, error, isLoading, mutate } = useSWR(
    `/patients/${patientId}`,
    () => patientService.getById(patientId),
  );

  if (isLoading) return <LoadingState rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!patient) return <ErrorState error={{ status: 404 }} />;

  return (
    <div className="bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
      <PatientForm patient={patient} />
    </div>
  );
}
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BedDouble, Loader2 } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/shared/select-native";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import { PatientPicker } from "@/components/shared/patient-picker";
import {
  admissionFormSchema,
  type AdmissionFormValues,
} from "@/features/admissions/schemas/admission-schema";
import { admissionService, wardService } from "@/services/admissions/admission-service";
import { encounterService } from "@/services/encounters/encounter-service";
import { patientService } from "@/services/patients/patient-service";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { isApiError } from "@/services/http/api-error";
import { formatDateTime } from "@/lib/date";
import type { Patient } from "@/services/http/api-types";

/** Admits a patient: choose the patient, the justifying encounter and a free bed. */
export function AdmissionForm() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get("patient_id");

  const [patient, setPatient] = React.useState<Patient | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const { data: presetPatient } = useSWR(patientIdParam ? `/patients/${patientIdParam}` : null, () =>
    patientService.getById(patientIdParam as string),
  );

  const { data: encounters, isValidating: loadingEncounters } = useSWR(
    patient ? `/encounters?patient_id=${patient.id}` : null,
    () => encounterService.list({ patient_id: patient?.id, per_page: 50 }),
  );

  const { data: wards } = useSWR("/wards", () => wardService.list());

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionFormSchema),
    defaultValues: { clinicPatientId: "", encounter_id: "", bed_id: "", reason: "" },
  });

  function selectPatient(next: Patient | null) {
    setPatient(next);
    setValue("clinicPatientId", next ? String(next.id) : "", { shouldValidate: true });
    setValue("encounter_id", "");
    setValue("bed_id", "");
  }

  React.useEffect(() => {
    if (presetPatient) {
      setPatient(presetPatient);
      setValue("clinicPatientId", String(presetPatient.id));
    }
  }, [presetPatient, setValue]);

  async function onSubmit(values: AdmissionFormValues) {
    setFormError(null);
    if (!patient) {
      setFormError("Select a patient before admitting.");
      return;
    }
    const canBeDoctor = user?.role === "DOCTOR" || user?.role === "SURGEON";
    try {
      const admission = await admissionService.create({
        patient_id: patient.id,
        encounter_id: Number(values.encounter_id),
        bed_id: Number(values.bed_id),
        reason: values.reason.trim(),
        admitting_doctor_id: canBeDoctor ? Number(user?.id) : undefined,
      });
      toast.success("Patient admitted");
      router.push(`/admissions/${admission.id}`);
      router.refresh();
    } catch (error) {
      setFormError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    }
  }

  const freeBeds = (wards ?? []).map((ward) => ({
    ward,
    beds: ward.beds.filter((bed) => !bed.occupied),
  }));
  const hasFreeBeds = freeBeds.some((group) => group.beds.length > 0);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <FormField id="clinicPatientId" label="Patient" required error={fieldMessage(errors.clinicPatientId)}>
        {() => <PatientPicker value={patient} onChange={selectPatient} disabled={Boolean(patientIdParam)} />}
      </FormField>

      <FormField
        id="encounter_id"
        label="Encounter"
        required
        description="The admission is attached to the encounter that justifies it."
        error={fieldMessage(errors.encounter_id)}
      >
        {(control) => (
          <SelectNative {...control} {...register("encounter_id")} disabled={!patient || loadingEncounters}>
            <option value="">
              {!patient
                ? "Select a patient first"
                : loadingEncounters
                  ? "Loading encounters…"
                  : "Select an encounter"}
            </option>
            {(encounters?.data ?? []).map((encounter) => (
              <option key={encounter.id} value={encounter.id}>
                #{encounter.id} · {encounter.encounter_type} · {formatDateTime(encounter.encounter_at)} ·{" "}
                {encounter.status}
              </option>
            ))}
          </SelectNative>
        )}
      </FormField>

      <FormField
        id="bed_id"
        label="Bed"
        required
        description={hasFreeBeds ? "Only free beds are listed." : "No free beds are currently available."}
        error={fieldMessage(errors.bed_id)}
      >
        {(control) => (
          <SelectNative {...control} {...register("bed_id")} disabled={!hasFreeBeds}>
            <option value="">{hasFreeBeds ? "Select a bed" : "No free beds"}</option>
            {freeBeds.map(({ ward, beds }) =>
              beds.length ? (
                <optgroup key={ward.id} label={`${ward.name} (${ward.code})`}>
                  {beds.map((bed) => (
                    <option key={bed.id} value={bed.id}>
                      {bed.bed_number}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </SelectNative>
        )}
      </FormField>

      <FormField
        id="reason"
        label="Reason for admission"
        required
        error={fieldMessage(errors.reason)}
      >
        {(control) => <Textarea {...control} {...register("reason")} rows={3} />}
      </FormField>

      {formError ? (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <BedDouble className="size-4" />}
          Admit patient
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

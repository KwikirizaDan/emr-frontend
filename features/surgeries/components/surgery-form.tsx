"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Slice } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/shared/select-native";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import { PatientPicker } from "@/components/shared/patient-picker";
import {
  scheduleSurgerySchema,
  type ScheduleSurgeryValues,
} from "@/features/surgeries/schemas/surgery-schema";
import { surgeryService } from "@/services/surgeries/surgery-service";
import { admissionService } from "@/services/admissions/admission-service";
import { patientService } from "@/services/patients/patient-service";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { isApiError } from "@/services/http/api-error";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/date";
import type { Patient } from "@/services/http/api-types";

/** Schedules a surgery against an admitted patient. */
export function SurgeryForm() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get("patient_id");

  const [patient, setPatient] = React.useState<Patient | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const defaultStart = React.useMemo(() => toDateTimeLocalValue(new Date()), []);
  const defaultEnd = React.useMemo(
    () => toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
    [],
  );

  const { data: presetPatient } = useSWR(patientIdParam ? `/patients/${patientIdParam}` : null, () =>
    patientService.getById(patientIdParam as string),
  );

  const { data: admissions, isValidating: loadingAdmissions } = useSWR(
    patient ? `/admissions?patient_id=${patient.id}&status=ADMITTED` : null,
    () => admissionService.list({ patient_id: patient?.id, status: "ADMITTED", per_page: 50 }),
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleSurgeryValues>({
    resolver: zodResolver(scheduleSurgerySchema),
    defaultValues: {
      clinicPatientId: "",
      admission_id: "",
      procedure_name: "",
      procedure_code: "",
      lead_surgeon_id: user?.role === "SURGEON" ? String(user.id) : "",
      theatre: "",
      scheduled_start: defaultStart,
      scheduled_end: defaultEnd,
    },
  });

  function selectPatient(next: Patient | null) {
    setPatient(next);
    setValue("clinicPatientId", next ? String(next.id) : "", { shouldValidate: true });
    setValue("admission_id", "");
  }

  React.useEffect(() => {
    if (presetPatient) {
      setPatient(presetPatient);
      setValue("clinicPatientId", String(presetPatient.id));
    }
  }, [presetPatient, setValue]);

  async function onSubmit(values: ScheduleSurgeryValues) {
    setFormError(null);
    if (!patient) {
      setFormError("Select a patient before scheduling.");
      return;
    }
    try {
      const surgery = await surgeryService.create({
        patient_id: patient.id,
        admission_id: Number(values.admission_id),
        procedure_name: values.procedure_name.trim(),
        procedure_code:
          values.procedure_code && values.procedure_code.trim() !== ""
            ? values.procedure_code.trim()
            : null,
        lead_surgeon_id: Number(values.lead_surgeon_id),
        theatre: values.theatre.trim(),
        scheduled_start: fromDateTimeLocalValue(values.scheduled_start),
        scheduled_end: fromDateTimeLocalValue(values.scheduled_end),
      });
      toast.success("Surgery scheduled");
      router.push(`/surgeries/${surgery.id}`);
      router.refresh();
    } catch (error) {
      setFormError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    }
  }

  const admitted = admissions?.data ?? [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <FormField id="clinicPatientId" label="Patient" required error={fieldMessage(errors.clinicPatientId)}>
        {() => <PatientPicker value={patient} onChange={selectPatient} disabled={Boolean(patientIdParam)} />}
      </FormField>

      <FormField
        id="admission_id"
        label="Admission"
        required
        description="Surgery is performed on an admitted patient. Only current admissions are listed."
        error={fieldMessage(errors.admission_id)}
      >
        {(control) => (
          <SelectNative {...control} {...register("admission_id")} disabled={!patient || loadingAdmissions}>
            <option value="">
              {!patient
                ? "Select a patient first"
                : loadingAdmissions
                  ? "Loading admissions…"
                  : admitted.length === 0
                    ? "No current admission for this patient"
                    : "Select the admission"}
            </option>
            {admitted.map((admission) => (
              <option key={admission.id} value={admission.id}>
                #{admission.id} · {admission.ward?.name ?? "—"} · bed {admission.bed_number ?? "—"}
              </option>
            ))}
          </SelectNative>
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="procedure_name" label="Procedure" required error={fieldMessage(errors.procedure_name)}>
          {(control) => <Input {...control} {...register("procedure_name")} autoComplete="off" />}
        </FormField>
        <FormField id="procedure_code" label="Procedure code" error={fieldMessage(errors.procedure_code)}>
          {(control) => <Input {...control} {...register("procedure_code")} autoComplete="off" />}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="lead_surgeon_id"
          label="Lead surgeon (user ID)"
          required
          description="Defaults to you when you are a surgeon. There is no clinician directory endpoint, so enter the ID directly otherwise."
          error={fieldMessage(errors.lead_surgeon_id)}
        >
          {(control) => <Input {...control} {...register("lead_surgeon_id")} inputMode="numeric" />}
        </FormField>
        <FormField id="theatre" label="Theatre" required error={fieldMessage(errors.theatre)}>
          {(control) => (
            <Input {...control} {...register("theatre")} placeholder="e.g. Theatre 2" autoComplete="off" />
          )}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="scheduled_start" label="Scheduled start" required error={fieldMessage(errors.scheduled_start)}>
          {(control) => <Input {...control} {...register("scheduled_start")} type="datetime-local" />}
        </FormField>
        <FormField id="scheduled_end" label="Scheduled end" required error={fieldMessage(errors.scheduled_end)}>
          {(control) => <Input {...control} {...register("scheduled_end")} type="datetime-local" />}
        </FormField>
      </div>

      {formError ? (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Slice className="size-4" />}
          Schedule surgery
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Loader2 } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import { PatientPicker } from "@/components/shared/patient-picker";
import {
  followUpFormSchema,
  type FollowUpFormValues,
} from "@/features/followups/schemas/followup-schema";
import { followUpService } from "@/services/followups/followup-service";
import { patientService } from "@/services/patients/patient-service";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { isApiError } from "@/services/http/api-error";
import { fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/date";
import type { Patient } from "@/services/http/api-types";

/** Books a follow-up appointment for a patient. */
export function FollowupForm() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get("patient_id");

  const [patient, setPatient] = React.useState<Patient | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const defaultWhen = React.useMemo(
    () => toDateTimeLocalValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    [],
  );

  const { data: presetPatient } = useSWR(patientIdParam ? `/patients/${patientIdParam}` : null, () =>
    patientService.getById(patientIdParam as string),
  );

  const canBeClinician = user?.role === "DOCTOR" || user?.role === "SURGEON";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpFormSchema),
    defaultValues: {
      clinicPatientId: "",
      scheduled_at: defaultWhen,
      clinician_id: canBeClinician ? String(user?.id ?? "") : "",
      reason: "",
    },
  });

  function selectPatient(next: Patient | null) {
    setPatient(next);
    setValue("clinicPatientId", next ? String(next.id) : "", { shouldValidate: true });
  }

  React.useEffect(() => {
    if (presetPatient) {
      setPatient(presetPatient);
      setValue("clinicPatientId", String(presetPatient.id));
    }
  }, [presetPatient, setValue]);

  async function onSubmit(values: FollowUpFormValues) {
    setFormError(null);
    if (!patient) {
      setFormError("Select a patient before booking.");
      return;
    }
    try {
      const followUp = await followUpService.create({
        patient_id: patient.id,
        scheduled_at: fromDateTimeLocalValue(values.scheduled_at),
        reason: values.reason.trim(),
        clinician_id: values.clinician_id && values.clinician_id !== "" ? Number(values.clinician_id) : null,
      });
      toast.success("Follow-up booked");
      router.push(`/follow-ups/${followUp.id}`);
      router.refresh();
    } catch (error) {
      setFormError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <FormField id="clinicPatientId" label="Patient" required error={fieldMessage(errors.clinicPatientId)}>
        {() => <PatientPicker value={patient} onChange={selectPatient} disabled={Boolean(patientIdParam)} />}
      </FormField>

      <FormField
        id="scheduled_at"
        label="Scheduled for"
        required
        description="Must be in the future."
        error={fieldMessage(errors.scheduled_at)}
      >
        {(control) => <Input {...control} {...register("scheduled_at")} type="datetime-local" />}
      </FormField>

      <FormField
        id="clinician_id"
        label="Clinician (user ID)"
        description="Optional. Defaults to you when you are a doctor or surgeon."
        error={fieldMessage(errors.clinician_id)}
      >
        {(control) => <Input {...control} {...register("clinician_id")} inputMode="numeric" />}
      </FormField>

      <FormField id="reason" label="Reason" required error={fieldMessage(errors.reason)}>
        {(control) => <Textarea {...control} {...register("reason")} rows={3} />}
      </FormField>

      {formError ? (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
          Book follow-up
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

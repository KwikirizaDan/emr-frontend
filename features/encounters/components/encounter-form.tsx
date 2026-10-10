"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Stethoscope } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/shared/select-native";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import { PatientPicker } from "@/components/shared/patient-picker";
import {
  encounterFormSchema,
  type EncounterFormValues,
} from "@/features/encounters/schemas/encounter-schema";
import { encounterService } from "@/services/encounters/encounter-service";
import { patientService } from "@/services/patients/patient-service";
import { isApiError } from "@/services/http/api-error";
import type { Patient } from "@/services/http/api-types";

export function EncounterForm({ patientId }: { patientId?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientIdParam = patientId ?? searchParams.get("patient_id");
  const [patient, setPatient] = React.useState<Patient | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Prefill from a patient profile action (e.g. "New encounter").
  const { data: presetPatient } = useSWR(
    patientIdParam ? `/patients/${patientIdParam}` : null,
    () => patientService.getById(patientIdParam as string),
  );

  React.useEffect(() => {
    if (presetPatient) setPatient(presetPatient);
  }, [presetPatient]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EncounterFormValues>({
    resolver: zodResolver(encounterFormSchema),
    defaultValues: { clinicPatientId: "", encounter_type: "OPD", chief_complaint: "", notes: "" },
  });

  function selectPatient(next: Patient | null) {
    setPatient(next);
    setValue("clinicPatientId", next ? String(next.id) : "", { shouldValidate: true });
  }

  React.useEffect(() => {
    if (presetPatient && !patient) setValue("clinicPatientId", String(presetPatient.id));
  }, [presetPatient, patient, setValue]);

  async function onSubmit(values: EncounterFormValues) {
    setFormError(null);
    if (!patient) {
      setFormError("Select a patient before saving the encounter.");
      return;
    }
    try {
      const encounter = await encounterService.create({
        patient_id: patient.id,
        encounter_type: values.encounter_type,
        chief_complaint: values.chief_complaint.trim(),
        notes: values.notes && values.notes.trim() !== "" ? values.notes.trim() : null,
      });
      toast.success("Encounter created");
      router.push(`/encounters/${encounter.id}`);
      router.refresh();
    } catch (error) {
      setFormError(
        isApiError(error) ? error.displayMessage : "The request could not be completed.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <FormField
        id="clinicPatientId"
        label="Patient"
        required
        error={fieldMessage(errors.clinicPatientId)}
      >
        {() => (
          <PatientPicker value={patient} onChange={selectPatient} disabled={Boolean(patientIdParam)} />
        )}
      </FormField>

      <FormField id="encounter_type" label="Encounter type" required error={fieldMessage(errors.encounter_type)}>
        {(control) => (
          <SelectNative {...control} {...register("encounter_type")}>
            <option value="OPD">OPD (outpatient)</option>
            <option value="EMERGENCY">Emergency</option>
          </SelectNative>
        )}
      </FormField>

      <FormField
        id="chief_complaint"
        label="Chief complaint"
        required
        description="The patient's presenting symptoms."
        error={fieldMessage(errors.chief_complaint)}
      >
        {(control) => <Textarea {...control} {...register("chief_complaint")} rows={3} />}
      </FormField>

      <FormField id="notes" label="Clinical notes" error={fieldMessage(errors.notes)}>
        {(control) => <Textarea {...control} {...register("notes")} rows={5} />}
      </FormField>

      {formError ? (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Stethoscope className="size-4" />}
          Create encounter
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
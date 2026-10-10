// Inline form for adding a diagnosis within the encounter detail page.
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/shared/select-native";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import {
  diagnosisFormSchema,
  toDiagnosisPayload,
  type DiagnosisFormValues,
} from "@/features/encounters/schemas/encounter-schema";
import { encounterService } from "@/services/encounters/encounter-service";
import { isApiError } from "@/services/http/api-error";

/** Inline form for recording a diagnosis against an open encounter. */
export function DiagnosisForm({
  encounterId,
  onAdded,
}: {
  encounterId: string | number;
  onAdded: () => void | Promise<void>;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DiagnosisFormValues>({
    resolver: zodResolver(diagnosisFormSchema),
    defaultValues: {
      description: "",
      code: "",
      diagnosis_type: "PRIMARY",
      certainty: "PROVISIONAL",
    },
  });

  async function onSubmit(values: DiagnosisFormValues) {
    setFormError(null);
    try {
      await encounterService.addDiagnosis(encounterId, toDiagnosisPayload(values));
      toast.success("Diagnosis recorded");
      reset();
      await onAdded();
    } catch (error) {
      setFormError(
        isApiError(error) ? error.displayMessage : "The request could not be completed.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormField
        id="diagnosis_description"
        label="Description"
        required
        error={fieldMessage(errors.description)}
      >
        {(control) => <Input {...control} {...register("description")} autoComplete="off" />}
      </FormField>

      <FormField
        id="diagnosis_code"
        label="Code"
        description="Optional clinical or ICD code."
        error={fieldMessage(errors.code)}
      >
        {(control) => <Input {...control} {...register("code")} autoComplete="off" />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="diagnosis_type" label="Type" required error={fieldMessage(errors.diagnosis_type)}>
          {(control) => (
            <SelectNative {...control} {...register("diagnosis_type")}>
              <option value="PRIMARY">Primary</option>
              <option value="SECONDARY">Secondary</option>
            </SelectNative>
          )}
        </FormField>

        <FormField id="diagnosis_certainty" label="Certainty" required error={fieldMessage(errors.certainty)}>
          {(control) => (
            <SelectNative {...control} {...register("certainty")}>
              <option value="PROVISIONAL">Provisional</option>
              <option value="CONFIRMED">Confirmed</option>
            </SelectNative>
          )}
        </FormField>
      </div>

      {formError ? (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </div>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add diagnosis
        </Button>
      </div>
    </form>
  );
}

"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SelectNative } from "@/components/shared/select-native";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import {
  DISCHARGE_CONDITIONS,
  dischargeFormSchema,
  type DischargeFormValues,
} from "@/features/admissions/schemas/admission-schema";
import { admissionService } from "@/services/admissions/admission-service";
import { isApiError } from "@/services/http/api-error";

const CONDITION_LABELS: Record<(typeof DISCHARGE_CONDITIONS)[number], string> = {
  RECOVERED: "Recovered",
  IMPROVED: "Improved",
  UNCHANGED: "Unchanged",
  TRANSFERRED: "Transferred",
  LEFT_AGAINST_ADVICE: "Left against advice",
  DECEASED: "Deceased",
};

/** Discharges an admitted patient; the summary is stored on the discharge record. */
export function DischargeForm({
  admissionId,
  onDischarged,
}: {
  admissionId: string | number;
  onDischarged: () => void | Promise<void>;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DischargeFormValues>({
    resolver: zodResolver(dischargeFormSchema),
    defaultValues: { condition_at_discharge: "RECOVERED", summary: "", instructions: "" },
  });

  async function onSubmit(values: DischargeFormValues) {
    setFormError(null);
    try {
      await admissionService.discharge(admissionId, {
        condition_at_discharge: values.condition_at_discharge,
        summary: values.summary.trim(),
        instructions: values.instructions && values.instructions.trim() !== "" ? values.instructions.trim() : null,
      });
      toast.success("Patient discharged");
      await onDischarged();
    } catch (error) {
      setFormError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormField
        id="condition_at_discharge"
        label="Condition at discharge"
        required
        error={fieldMessage(errors.condition_at_discharge)}
      >
        {(control) => (
          <SelectNative {...control} {...register("condition_at_discharge")}>
            {DISCHARGE_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {CONDITION_LABELS[condition]}
              </option>
            ))}
          </SelectNative>
        )}
      </FormField>

      <FormField
        id="summary"
        label="Discharge summary"
        required
        description="A clinical summary of the admission and treatment (at least 10 characters)."
        error={fieldMessage(errors.summary)}
      >
        {(control) => <Textarea {...control} {...register("summary")} rows={4} />}
      </FormField>

      <FormField
        id="instructions"
        label="Instructions"
        description="Optional aftercare instructions given to the patient."
        error={fieldMessage(errors.instructions)}
      >
        {(control) => <Textarea {...control} {...register("instructions")} rows={3} />}
      </FormField>

      {formError ? (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </div>
      ) : null}

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Discharge patient
        </Button>
      </div>
    </form>
  );
}

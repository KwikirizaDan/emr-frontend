// Create/edit form for a patient record, shared by the register and edit pages.
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/shared/select-native";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import {
  patientFormSchema,
  toPatientPayload,
  type PatientFormValues,
} from "@/features/patients/schemas/patient-schema";
import { patientService } from "@/services/patients/patient-service";
import { isApiError } from "@/services/http/api-error";
import type { Patient } from "@/services/http/api-types";

type PatientFormProps = {
  /** Present when editing; omitted when registering. */
  patient?: Patient;
};

/** Patient registration/edit form, prefilled from `patient` when editing. */
export function PatientForm({ patient }: PatientFormProps) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [duplicateId, setDuplicateId] = React.useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      first_name: patient?.first_name ?? "",
      last_name: patient?.last_name ?? "",
      sex: patient?.sex ?? "FEMALE",
      date_of_birth: patient?.date_of_birth ?? "",
      national_id: patient?.national_id ?? "",
      phone: patient?.phone ?? "",
      address: patient?.address ?? "",
      next_of_kin_name: patient?.next_of_kin_name ?? "",
      next_of_kin_phone: patient?.next_of_kin_phone ?? "",
    },
  });

  async function onSubmit(values: PatientFormValues) {
    setFormError(null);
    setDuplicateId(null);
    const payload = toPatientPayload(patientFormSchema.parse(values));
    try {
      if (patient) {
        await patientService.update(patient.id, payload);
        toast.success("Patient updated");
        router.push(`/patients/${patient.id}`);
      } else {
        const created = await patientService.create(payload);
        toast.success(`Patient registered as ${created.mrn}`);
        router.push(`/patients/${created.id}`);
      }
      router.refresh();
    } catch (error) {
      if (isApiError(error) && error.isConflict) {
        // Conflict means a matching record exists; link to it instead of a generic error.
        const existing = error.details?.existing_patient_id;
        setDuplicateId(typeof existing === "number" ? existing : null);
        setFormError(error.message);
        return;
      }
      setFormError(
        isApiError(error) ? error.displayMessage : "The request could not be completed.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="first_name" label="First name" required error={fieldMessage(errors.first_name)}>
          {(control) => <Input {...control} {...register("first_name")} autoComplete="off" />}
        </FormField>

        <FormField id="last_name" label="Last name" required error={fieldMessage(errors.last_name)}>
          {(control) => <Input {...control} {...register("last_name")} autoComplete="off" />}
        </FormField>

        <FormField id="sex" label="Sex" required error={fieldMessage(errors.sex)}>
          {(control) => (
            <SelectNative {...control} {...register("sex")}>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
            </SelectNative>
          )}
        </FormField>

        <FormField id="date_of_birth" label="Date of birth" required error={fieldMessage(errors.date_of_birth)}>
          {(control) => (
            <Input {...control} {...register("date_of_birth")} type="date" max={new Date().toISOString().slice(0, 10)} />
          )}
        </FormField>

        <FormField
          id="national_id"
          label="National ID"
          description="Optional. Letters and digits only."
          error={fieldMessage(errors.national_id)}
        >
          {(control) => <Input {...control} {...register("national_id")} autoComplete="off" />}
        </FormField>

        <FormField
          id="phone"
          label="Phone"
          description="Optional. 7–20 digits, optionally starting with +."
          error={fieldMessage(errors.phone)}
        >
          {(control) => <Input {...control} {...register("phone")} inputMode="tel" autoComplete="off" />}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="address" label="Address" error={fieldMessage(errors.address)}>
          {(control) => <Input {...control} {...register("address")} autoComplete="off" />}
        </FormField>

        <FormField id="next_of_kin_name" label="Next of kin name" error={fieldMessage(errors.next_of_kin_name)}>
          {(control) => <Input {...control} {...register("next_of_kin_name")} autoComplete="off" />}
        </FormField>

        <FormField id="next_of_kin_phone" label="Next of kin phone" error={fieldMessage(errors.next_of_kin_phone)}>
          {(control) => (
            <Input {...control} {...register("next_of_kin_phone")} inputMode="tel" autoComplete="off" />
          )}
        </FormField>
      </div>

      {formError ? (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
          {duplicateId ? (
            <Link
              href={`/patients/${duplicateId}`}
              className="ml-1 font-medium underline underline-offset-4"
            >
              View the existing record
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {patient ? "Save changes" : "Register patient"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
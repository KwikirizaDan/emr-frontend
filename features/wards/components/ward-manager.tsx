// Ward and bed administration screen for hospital administrators.
"use client";

import * as React from "react";
import { BedDouble, Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import { LoadingState } from "@/components/shared/loading-state";
import { wardService } from "@/services/admissions/admission-service";
import { bedFormSchema, wardFormSchema, type WardFormValues } from "@/features/wards/schemas/ward-schema";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { can, PERMISSIONS } from "@/lib/permissions";
import { isApiError } from "@/services/http/api-error";
import type { WardWithBeds } from "@/services/http/api-types";

/** Ward and bed administration. Visible to administrators only. */
export function WardManager() {
  const { user } = useCurrentUser();
  const canManage = can({ role: user?.role }, PERMISSIONS.wardManage);

  const { data: wards, error, isLoading, mutate } = useSWR("/wards", () => wardService.list());

  if (isLoading) return <LoadingState rows={3} />;
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;

  const rows = wards ?? [];

  return (
    <div className="grid gap-6">
      {canManage ? (
        <CreateWardForm
          onCreated={async () => {
            await mutate();
          }}
        />
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={BedDouble}
          title="No wards configured"
          description="Create a ward, then add beds to it so patients can be admitted."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((ward) => (
            <WardCard
              key={ward.id}
              ward={ward}
              canManage={canManage}
              onChanged={async () => {
                await mutate();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Compact form for creating a new ward. */
function CreateWardForm({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WardFormValues>({
    resolver: zodResolver(wardFormSchema),
    defaultValues: { code: "", name: "" },
  });

  async function onSubmit(values: WardFormValues) {
    setFormError(null);
    try {
      await wardService.create({ code: values.code.trim().toUpperCase(), name: values.name.trim() });
      toast.success("Ward created");
      reset();
      await onCreated();
    } catch (error) {
      setFormError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New ward</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <FormField id="ward_code" label="Code" required error={fieldMessage(errors.code)}>
              {(control) => (
                <Input {...control} {...register("code")} placeholder="e.g. MALE-W1" autoComplete="off" />
              )}
            </FormField>
            <FormField id="ward_name" label="Name" required error={fieldMessage(errors.name)}>
              {(control) => (
                <Input {...control} {...register("name")} placeholder="e.g. Male Medical Ward 1" autoComplete="off" />
              )}
            </FormField>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create ward
            </Button>
          </div>
          {formError ? (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

/** Displays one ward with its beds and, for managers, an inline add-bed control. */
function WardCard({
  ward,
  canManage,
  onChanged,
}: {
  ward: WardWithBeds;
  canManage: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [bedNumber, setBedNumber] = React.useState("");
  const [bedError, setBedError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  async function addBed() {
    const parsed = bedFormSchema.safeParse({ bed_number: bedNumber });
    if (!parsed.success) {
      setBedError(parsed.error.issues[0]?.message ?? "Enter a bed number.");
      return;
    }
    setAdding(true);
    setBedError(null);
    try {
      await wardService.addBed(ward.id, parsed.data.bed_number.trim().toUpperCase());
      toast.success("Bed added");
      setBedNumber("");
      await onChanged();
    } catch (error) {
      setBedError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setAdding(false);
    }
  }

  const occupied = ward.beds.filter((bed) => bed.occupied).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="grid gap-0.5">
          <CardTitle className="text-base">{ward.name}</CardTitle>
          <span className="font-mono text-xs text-muted-foreground">{ward.code}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{occupied} occupied</Badge>
          <Badge variant="secondary">{ward.free_beds} free</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {ward.beds.length === 0 ? (
          <p className="text-xs text-muted-foreground">No beds yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {ward.beds.map((bed) => (
              <li key={bed.id}>
                <Badge variant={bed.occupied ? "secondary" : "outline"} className="gap-1">
                  <BedDouble className="size-3" aria-hidden="true" />
                  {bed.bed_number}
                  <span className="text-muted-foreground">{bed.occupied ? "occupied" : "free"}</span>
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {canManage ? (
          <div className="grid gap-1.5">
            <div className="flex items-end gap-2">
              <Input
                value={bedNumber}
                onChange={(event) => setBedNumber(event.target.value)}
                placeholder="Bed number, e.g. B12"
                aria-label={`Add a bed to ${ward.name}`}
                className="max-w-40"
              />
              <Button type="button" variant="outline" onClick={addBed} disabled={adding}>
                {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add bed
              </Button>
            </div>
            {bedError ? <p className="text-xs text-destructive">{bedError}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

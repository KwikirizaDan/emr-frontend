/** Surgery record view with start, complete and cancel actions. */
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, Play, Slice, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import { LoadingState } from "@/components/shared/loading-state";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import {
  completeSurgerySchema,
  type CompleteSurgeryValues,
} from "@/features/surgeries/schemas/surgery-schema";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { surgeryService } from "@/services/surgeries/surgery-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import { isApiError } from "@/services/http/api-error";

/** Loads the surgery by route id and exposes its lifecycle actions. */
export function SurgeryDetail() {
  const params = useParams<{ surgeryId: string }>();
  const surgeryId = params.surgeryId;
  const { user } = useCurrentUser();
  const [starting, setStarting] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const { data: surgery, error, isLoading, mutate } = useSWR(
    `/surgeries/${surgeryId}`,
    () => surgeryService.getById(surgeryId),
  );

  if (isLoading) return <LoadingState rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!surgery) {
    return (
      <EmptyState
        icon={Slice}
        title="Surgery not found"
        description="This surgery may have been removed or is no longer available."
      />
    );
  }

  const canManage = can({ role: user?.role }, PERMISSIONS.surgeryManage);

  async function start() {
    setStarting(true);
    try {
      await surgeryService.start(surgeryId);
      toast.success("Surgery started");
      await mutate();
    } catch (error) {
      toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setStarting(false);
    }
  }

  async function confirmCancel() {
    if (reason.trim().length < 5) {
      setReasonError("Enter a reason of at least 5 characters.");
      return;
    }
    setCancelling(true);
    setReasonError(null);
    try {
      await surgeryService.cancel(surgeryId, { reason: reason.trim() });
      toast.success("Surgery cancelled");
      setCancelOpen(false);
      setReason("");
      await mutate();
    } catch (error) {
      toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Surgery #{surgery.id}</h1>
          <WorkflowStatusBadge status={surgery.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {surgery.procedure_name}
          {surgery.procedure_code ? ` (${surgery.procedure_code})` : ""} ·{" "}
          <Link
            href={`/patients/${surgery.patient_id}`}
            className="underline-offset-4 hover:text-primary hover:underline"
          >
            Patient #{surgery.patient_id}
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Surgery details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail label="Admission" value={`#${surgery.admission_id}`} />
          <Detail label="Theatre" value={surgery.theatre} />
          <Detail label="Lead surgeon" value={`#${surgery.lead_surgeon_id}`} />
          <Detail label="Scheduled start" value={formatDateTime(surgery.scheduled_start)} />
          <Detail label="Scheduled end" value={formatDateTime(surgery.scheduled_end)} />
          <Detail label="Started" value={surgery.started_at ? formatDateTime(surgery.started_at) : "—"} />
          <Detail
            label="Completed"
            value={surgery.completed_at ? formatDateTime(surgery.completed_at) : "—"}
          />
          {surgery.outcome_notes ? (
            <Detail label="Outcome" value={surgery.outcome_notes} className="sm:col-span-2" />
          ) : null}
          {surgery.cancel_reason ? (
            <Detail label="Cancellation reason" value={surgery.cancel_reason} className="sm:col-span-2" />
          ) : null}
        </CardContent>
      </Card>

      {canManage ? (
        <>
          {surgery.status === "SCHEDULED" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button onClick={start} disabled={starting}>
                  {starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  Start surgery
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    setReason("");
                    setReasonError(null);
                    setCancelOpen(true);
                  }}
                >
                  <XCircle className="size-4" />
                  Cancel surgery
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {surgery.status === "IN_PROGRESS" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Complete surgery</CardTitle>
              </CardHeader>
              <CardContent>
                <CompleteForm
                  surgeryId={surgery.id}
                  onCompleted={async () => {
                    await mutate();
                  }}
                />
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this surgery?"
        destructive
        pending={cancelling}
        confirmLabel="Cancel surgery"
        description={`Surgery #${surgery.id} will be marked as cancelled. The record is retained for audit.`}
        reasonLabel="Reason for cancellation"
        reasonDescription="This reason is stored in the audit log and cannot be changed later."
        reasonValue={reason}
        onReasonChange={setReason}
        reasonError={reasonError}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

/** Read-only label/value pair used in the detail cards. */
function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className ? `grid gap-0.5 ${className}` : "grid gap-0.5"}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm whitespace-pre-wrap">{value}</span>
    </div>
  );
}

/** Inline form that records outcome notes and completes the surgery. */
function CompleteForm({
  surgeryId,
  onCompleted,
}: {
  surgeryId: number;
  onCompleted: () => void | Promise<void>;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompleteSurgeryValues>({
    resolver: zodResolver(completeSurgerySchema),
    defaultValues: { outcome_notes: "" },
  });

  async function onSubmit(values: CompleteSurgeryValues) {
    setFormError(null);
    try {
      await surgeryService.complete(surgeryId, { outcome_notes: values.outcome_notes.trim() });
      toast.success("Surgery completed");
      await onCompleted();
    } catch (error) {
      setFormError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormField id="outcome_notes" label="Outcome notes" required error={fieldMessage(errors.outcome_notes)}>
        {(control) => <Textarea {...control} {...register("outcome_notes")} rows={4} />}
      </FormField>
      {formError ? (
        <p role="alert" className="text-xs text-destructive">
          {formError}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Complete surgery
        </Button>
      </div>
    </form>
  );
}

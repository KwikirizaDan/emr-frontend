"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Stethoscope, Trash2 } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import { DiagnosisForm } from "@/features/encounters/components/diagnosis-form";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { encounterService } from "@/services/encounters/encounter-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import { humanizeEnum } from "@/lib/formatters";
import { isApiError } from "@/services/http/api-error";
import type { Diagnosis } from "@/services/http/api-types";

export function EncounterDetail() {
  const params = useParams<{ encounterId: string }>();
  const encounterId = params.encounterId;
  const { user } = useCurrentUser();
  const [closing, setClosing] = React.useState(false);
  const [pendingDiagnosis, setPendingDiagnosis] = React.useState<Diagnosis | null>(null);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const { data: encounter, error, isLoading, mutate } = useSWR(
    `/encounters/${encounterId}`,
    () => encounterService.getById(encounterId),
  );

  if (isLoading) return <LoadingState rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!encounter) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="Encounter not found"
        description="This encounter may have been voided or is no longer available."
      />
    );
  }

  const isOpen = encounter.status === "OPEN";
  const canClose = can({ role: user?.role }, PERMISSIONS.encounterClose);
  const canDiagnose = can({ role: user?.role }, PERMISSIONS.diagnosisCreate);
  const canDeleteDiagnosis = can({ role: user?.role }, PERMISSIONS.diagnosisDelete);
  const canVoid = can({ role: user?.role }, PERMISSIONS.encounterUpdate);

  async function closeEncounter() {
    setClosing(true);
    try {
      await encounterService.close(encounterId);
      toast.success("Encounter closed");
      await mutate();
    } catch (error) {
      toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setClosing(false);
    }
  }

  async function confirmDeleteDiagnosis() {
    if (!pendingDiagnosis) return;
    if (reason.trim().length < 5) {
      setReasonError("Enter a reason of at least 5 characters.");
      return;
    }
    setDeleting(true);
    setReasonError(null);
    try {
      await encounterService.removeDiagnosis(pendingDiagnosis.id, reason.trim());
      toast.success("Diagnosis removed");
      setPendingDiagnosis(null);
      setReason("");
      await mutate();
    } catch (error) {
      toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Encounter #{encounter.id}</h1>
            <WorkflowStatusBadge status={encounter.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {humanizeEnum(encounter.encounter_type)} ·{" "}
            <Link
              href={`/patients/${encounter.patient_id}`}
              className="underline-offset-4 hover:text-primary hover:underline"
            >
              Patient #{encounter.patient_id}
            </Link>{" "}
            · {formatDateTime(encounter.encounter_at)}
          </p>
        </div>
        {isOpen && canClose ? (
          <Button onClick={closeEncounter} disabled={closing}>
            <CheckCircle2 className="size-4" />
            Close encounter
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clinical record</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Chief complaint</span>
            <span className="text-sm">{encounter.chief_complaint}</span>
          </div>
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">Notes</span>
            <span className="text-sm whitespace-pre-wrap">{encounter.notes || "—"}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Clinician</span>
              <span className="text-sm">#{encounter.clinician_id}</span>
            </div>
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Closed</span>
              <span className="text-sm">
                {encounter.closed_at ? formatDateTime(encounter.closed_at) : "Not yet closed"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Diagnoses</CardTitle>
          <span className="text-xs text-muted-foreground">
            {encounter.diagnoses.length} recorded
          </span>
        </CardHeader>
        <CardContent className="grid gap-5">
          {encounter.diagnoses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No diagnoses recorded yet.</p>
          ) : (
            <ul className="grid gap-2">
              {encounter.diagnoses.map((diagnosis) => (
                <li
                  key={diagnosis.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-3 py-2"
                >
                  <div className="grid gap-1">
                    <span className="text-sm font-medium">{diagnosis.description}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={diagnosis.diagnosis_type === "PRIMARY" ? "default" : "secondary"}>
                        {humanizeEnum(diagnosis.diagnosis_type)}
                      </Badge>
                      <Badge variant="outline">{humanizeEnum(diagnosis.certainty)}</Badge>
                      {diagnosis.code ? (
                        <span className="font-mono text-xs text-muted-foreground">{diagnosis.code}</span>
                      ) : null}
                    </div>
                  </div>
                  {isOpen && canDeleteDiagnosis ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive"
                      onClick={() => {
                        setPendingDiagnosis(diagnosis);
                        setReason("");
                        setReasonError(null);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {isOpen ? (
            canDiagnose ? (
              <div className="border-t border-border pt-5">
                <h3 className="mb-4 text-sm font-medium">Record a diagnosis</h3>
                <DiagnosisForm
                  encounterId={encounter.id}
                  onAdded={async () => {
                    await mutate();
                  }}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only clinicians may add diagnoses.
              </p>
            )
          ) : (
            <p className="border-t border-border pt-5 text-xs text-muted-foreground">
              This encounter is closed and its record is read-only.
            </p>
          )}
        </CardContent>
      </Card>

      {isOpen && canVoid ? <VoidEncounterButton encounterId={encounter.id} /> : null}

      <ConfirmDialog
        open={Boolean(pendingDiagnosis)}
        onOpenChange={(open) => {
          if (!open) setPendingDiagnosis(null);
        }}
        title="Remove this diagnosis?"
        destructive
        pending={deleting}
        confirmLabel="Remove diagnosis"
        description={
          pendingDiagnosis
            ? `${pendingDiagnosis.description} will be voided. The record is kept for audit.`
            : ""
        }
        reasonLabel="Reason for removal"
        reasonDescription="This reason is stored in the audit log and cannot be changed later."
        reasonValue={reason}
        onReasonChange={setReason}
        reasonError={reasonError}
        onConfirm={confirmDeleteDiagnosis}
      />
    </div>
  );
}

function VoidEncounterButton({ encounterId }: { encounterId: number }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  return (
    <>
      <div>
        <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" />
          Void encounter
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Void this encounter?"
        destructive
        pending={pending}
        confirmLabel="Void encounter"
        description="The encounter is voided but retained for audit. This cannot be undone from the app."
        reasonLabel="Reason for voiding"
        reasonDescription="This reason is stored in the audit log and cannot be changed later."
        reasonValue={reason}
        onReasonChange={setReason}
        reasonError={reasonError}
        onConfirm={async () => {
          if (reason.trim().length < 5) {
            setReasonError("Enter a reason of at least 5 characters.");
            return;
          }
          setPending(true);
          setReasonError(null);
          try {
            await encounterService.remove(encounterId, reason.trim());
            toast.success("Encounter voided");
            setOpen(false);
            router.push("/encounters");
            router.refresh();
          } catch (error) {
            toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
          } finally {
            setPending(false);
          }
        }}
      />
    </>
  );
}

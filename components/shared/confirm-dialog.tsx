/** Confirmation dialog for destructive or irreversible clinical actions. */
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Always name the exact record: show the patient name and MRN. */
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Shown while the action is in flight. */
  pending?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  onConfirm: () => void | Promise<void>;
  /**
   * When set, a required reason field is rendered above the confirm button.
   * Use it for soft-delete and cancel actions that the API requires a reason for.
   */
  reasonLabel?: string;
  reasonDescription?: string;
  reasonValue?: string;
  onReasonChange?: (value: string) => void;
  reasonError?: string | null;
  children?: React.ReactNode;
};

/**
 * Confirmation dialog for destructive or irreversible actions.
 *
 * Used for patient soft-delete, surgery cancellation, discharge and other
 * consequential transitions. A reason field is provided wherever the API
 * requires one.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  icon: Icon,
  onConfirm,
  reasonLabel,
  reasonDescription,
  reasonValue,
  onReasonChange,
  reasonError,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          {Icon ? (
            <AlertDialogMedia
              className={
                destructive
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }
            >
              <Icon className="size-5" />
            </AlertDialogMedia>
          ) : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {reasonLabel && onReasonChange ? (
          <FormField
            id="confirm-reason"
            label={reasonLabel}
            required
            description={reasonDescription}
            error={reasonError ?? undefined}
          >
            {(control) => (
              <Textarea
                {...control}
                value={reasonValue ?? ""}
                onChange={(event) => onReasonChange(event.target.value)}
                rows={3}
                placeholder="Enter the reason for this action"
                disabled={pending}
              />
            )}
          </FormField>
        ) : null}

        {children}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            render={
              <Button
                variant={destructive ? "destructive" : "default"}
                disabled={pending}
                onClick={() => void onConfirm()}
              />
            }
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Working…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Labelled form field with description, error message and accessible wiring. */
import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** Props injected into a field's control by {@link FormField}. */
export type FormControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": boolean;
};

/** Props accepted by {@link FormField}. */
export type FormFieldProps = {
  label: string;
  /** Unique id; used to link label, description and error to the control. */
  id: string;
  error?: string | null;
  description?: string | React.ReactNode;
  required?: boolean;
  className?: string;
  /** Optional element rendered to the right of the label (e.g. a hint link). */
  action?: React.ReactNode;
  children: (control: FormControlProps) => React.ReactNode;
};

/**
 * Standard labelled field: label, optional required marker, description, and an
 * inline error message wired to the control with `aria-describedby`.
 */
export function FormField({
  label,
  id,
  error,
  description,
  required = false,
  className,
  action,
  children,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
          ) : null}
        </Label>
        {action}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": Boolean(error) })}
      {description && !error ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Maps a React Hook Form error to the message shown under a field. */
export function fieldMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

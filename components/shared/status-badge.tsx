import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { humanizeEnum } from "@/lib/formatters";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

const TONE_ICONS: Record<StatusTone, LucideIcon> = {
  neutral: CircleDashed,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};

export type StatusBadgeProps = {
  /** Raw status value from the API, e.g. `IN_PROGRESS`. */
  status: string | null | undefined;
  tone?: StatusTone;
  /** Overrides the auto-formatted label. */
  label?: string;
  /** Set false only for decorative status where colour is used elsewhere. */
  showIcon?: boolean;
  className?: string;
};

/**
 * Status is never communicated by colour alone: the badge always carries an
 * icon plus the label text.
 */
export function StatusBadge({
  status,
  tone = "neutral",
  label,
  showIcon = true,
  className,
}: StatusBadgeProps) {
  const Icon = TONE_ICONS[tone];
  const text = label ?? humanizeEnum(status);

  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", TONE_CLASSES[tone], className)}>
      {showIcon ? <Icon className="size-3" aria-hidden="true" /> : null}
      {text}
    </Badge>
  );
}

/**
 * Maps common clinical workflow statuses to a tone. Unknown values fall back to
 * neutral rather than guessing a semantic meaning.
 */
const STATUS_TONES: Record<string, StatusTone> = {
  // Encounters
  OPEN: "info",
  IN_PROGRESS: "info",
  CLOSED: "neutral",
  // Admissions
  ADMITTED: "info",
  DISCHARGED: "neutral",
  CANCELLED: "danger",
  // Beds
  AVAILABLE: "success",
  OCCUPIED: "warning",
  OUT_OF_SERVICE: "danger",
  // Surgeries
  SCHEDULED: "info",
  COMPLETED: "success",
  // Follow-ups
  PENDING: "info",
  DUE: "warning",
  MISSED: "danger",
  RESCHEDULED: "info",
  // Users
  ACTIVE: "success",
  INACTIVE: "neutral",
};

export function toneForStatus(status: string | null | undefined): StatusTone {
  if (!status) return "neutral";
  return STATUS_TONES[status] ?? "neutral";
}

/** Convenience wrapper that derives the tone from the status value. */
export function WorkflowStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  return <StatusBadge status={status} tone={toneForStatus(status)} className={className} />;
}

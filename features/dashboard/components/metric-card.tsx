/** Summary metric card for the dashboard. */
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { humanizeEnum } from "@/lib/formatters";

export type MetricCardProps = {
  /** Raw key from the dashboard response, humanised for display. */
  metricKey: string;
  value: number | string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
};

/**
 * Renders one summary count exactly as the API returned it.
 *
 * Values are passed through untouched, so a metric is only shown when the
 * backend actually supplied it.
 */
export function MetricCard({ metricKey, value, description, icon: Icon, className }: MetricCardProps) {
  return (
    <Card className={cn("gap-2", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {humanizeEnum(metricKey)}
        </CardTitle>
        {Icon ? (
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center bg-primary/10 text-primary"
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

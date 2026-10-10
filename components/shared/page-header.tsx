/** Consistent page header: title, one-line description and primary actions. */
import * as React from "react";

import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  /** One sentence describing what the page is for. */
  description?: string;
  /** Primary action(s) for the page, e.g. "Register patient". */
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Consistent page title, one-sentence description and primary action, matching
 * the dashboard-01 shell so every screen reads the same way.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

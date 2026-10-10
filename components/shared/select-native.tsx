/** Native select control styled with the shared design tokens. */
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Native `<select>` styled with the shadcn input tokens.
 *
 * A native control is used where a form needs a dependable, accessible select
 * that works with progressive enhancement and does not require a portal. The
 * richer shadcn `Select` remains available for more custom menus.
 */
function SelectNative({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select-native"
      className={cn(
        "h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2 py-1 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { SelectNative };
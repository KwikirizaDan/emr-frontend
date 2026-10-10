/** Shared loading placeholders for detail views and summary sections. */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Row-shaped skeleton list, announced politely to assistive technology. */
export function LoadingState({
  label = "Loading…",
  rows = 5,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

/** Grid of card-shaped skeletons for summary sections. */
export function LoadingCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)} role="status" aria-live="polite">
      <span className="sr-only">Loading summary…</span>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="grid gap-2 rounded-none bg-card p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

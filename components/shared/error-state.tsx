"use client";

import * as React from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/services/http/api-error";

export type ErrorStateProps = {
  error: ApiError | Error | unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
};

function describe(error: unknown): { message: string; requestId: string | null } {
  const apiError = error as Partial<ApiError> | undefined;
  const status = apiError?.status;
  const requestId = apiError?.requestId ?? null;

  if (status === 403) {
    return {
      message: "You do not have permission to view this information.",
      requestId,
    };
  }
  if (status === 404) {
    return { message: "The record could not be found or is no longer available.", requestId };
  }
  if (status === 0 || (typeof status === "number" && status >= 500)) {
    return {
      message: "The EMR service is temporarily unavailable. Please try again.",
      requestId,
    };
  }
  return {
    message: apiError?.message || "Something went wrong while loading this information.",
    requestId,
  };
}

/**
 * Error state with an optional retry. The Flask message is shown when it is
 * safe to render, and the request id is surfaced for support diagnostics.
 * Stack traces and internal exception detail are never shown.
 */
export function ErrorState({ error, onRetry, title = "Unable to load this information", className }: ErrorStateProps) {
  const { message, requestId } = describe(error);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center bg-destructive/10 text-destructive"
      >
        <TriangleAlert className="size-5" />
      </span>
      <div className="grid gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{message}</p>
        {requestId ? (
          <p className="font-mono text-xs text-muted-foreground">Reference: {requestId}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

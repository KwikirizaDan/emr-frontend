/**
 * Global client providers: shared SWR request defaults plus the toast and
 * tooltip hosts mounted once at the root of the app.
 */
"use client";

import * as React from "react";
import { SWRConfig } from "swr";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ApiError } from "@/services/http/api-error";

/**
 * Retry only on transport-level failures. A `403` or `409` will not fix
 * itself, so hammering the API for a clinical workspace is avoided.
 */
function shouldRetry(error: unknown): boolean {
  const status = (error as ApiError | undefined)?.status;
  return status === 0 || status === undefined;
}

/** Wraps the app in the shared SWR and UI provider stack. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateIfStale: true,
        shouldRetryOnError: shouldRetry,
        errorRetryCount: 1,
        dedupingInterval: 2_000,
      }}
    >
      <TooltipProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </TooltipProvider>
    </SWRConfig>
  );
}

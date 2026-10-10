// Server-state hook backing the patient register table.
import useSWR from "swr";

import { patientService, type PatientFilters } from "@/services/patients/patient-service";
import type { Patient } from "@/services/http/api-types";

const DEFAULT_FILTERS: Required<Pick<PatientFilters, "page" | "per_page">> = {
  page: 1,
  per_page: 20,
};

/** Builds the SWR cache key from the active filters, applying pagination defaults. */
function buildKey(filters: PatientFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(filters.page ?? DEFAULT_FILTERS.page));
  params.set("per_page", String(filters.per_page ?? DEFAULT_FILTERS.per_page));
  return `/patients?${params.toString()}`;
}

/** Server-side patient search with caching, retry and revalidation. */
export function usePatients(filters: PatientFilters = {}) {
  const key = buildKey(filters);
  const { data, error, isLoading, isValidating, mutate } = useSWR(key, () =>
    patientService.list(filters),
  );

  return {
    rows: (data?.data ?? []) as Patient[],
    meta: data?.meta ?? null,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
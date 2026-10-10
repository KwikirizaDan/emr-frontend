/** Searchable, server-backed patient picker used across clinical forms. */
"use client";

import * as React from "react";
import { Search, UserRoundCheck, X } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { patientService } from "@/services/patients/patient-service";
import { formatPersonDisplayName, formatMrn } from "@/lib/formatters";
import type { Patient } from "@/services/http/api-types";
import { cn } from "@/lib/utils";

export type PatientPickerProps = {
  id?: string;
  value: Patient | null;
  onChange: (patient: Patient | null) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Searchable patient lookup used by encounter, admission, surgery and follow-up
 * forms. Searches the server by name, MRN, national ID or phone — it never
 * downloads the whole register.
 */
export function PatientPicker({ id = "patient-picker", value, onChange, disabled, autoFocus }: PatientPickerProps) {
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  // Debounce typing so the server search runs only after the user pauses.
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(handle);
  }, [term]);

  const key = `/patients?q=${encodeURIComponent(debounced)}`;
  const { data, isLoading } = useSWR(
    disabled && value ? null : key,
    () => patientService.list({ q: debounced || undefined, per_page: 8 }),
    { keepPreviousData: true },
  );

  const rows = data?.data ?? [];

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 border border-input bg-muted/40 px-2.5 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <UserRoundCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="grid min-w-0">
            <span className="truncate text-xs font-medium">
              {formatPersonDisplayName(value)}
            </span>
            <span className="truncate text-xs text-muted-foreground">{formatMrn(value.mrn)}</span>
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={() => onChange(null)}
          aria-label="Clear selected patient"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="search"
          value={term}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search name, MRN, national ID or phone"
          className="pl-7"
          autoComplete="off"
        />
      </div>

      <div className="max-h-48 overflow-y-auto border border-input" role="listbox" aria-label="Patient search results">
        {isLoading ? (
          <div className="grid gap-2 p-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            {debounced
              ? "No patients match this search."
              : "Start typing to find a patient."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={disabled}
                  onClick={() => onChange(patient)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                  )}
                >
                  <span className="grid min-w-0">
                    <span className="truncate font-medium">{formatPersonDisplayName(patient)}</span>
                    <span className="truncate text-muted-foreground">
                      {formatMrn(patient.mrn)} · {patient.sex}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {patient.date_of_birth}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
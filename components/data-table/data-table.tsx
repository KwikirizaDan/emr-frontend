"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/services/http/api-types";

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Rendered inside the table body when there are no rows. */
  empty?: React.ReactNode;
  meta?: PaginationMeta | null;
  onPageChange?: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  pageSizeOptions?: number[];
  /** Describes the table for screen readers. */
  caption?: string;
  rowClassName?: (row: T) => string | undefined;
};

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

/**
 * Server-driven data table.
 *
 * Pagination always comes from the API `meta` object; the component never
 * paginates a full record set in the browser. Loading, empty and error states
 * are built in so every clinical table behaves the same way.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  error,
  onRetry,
  empty,
  meta,
  onPageChange,
  onPerPageChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  caption,
  rowClassName,
}: DataTableProps<T>) {
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  const page = meta?.page ?? 1;
  const pages = meta?.pages ?? (rows.length > 0 ? 1 : 0);
  const total = meta?.total ?? rows.length;
  const perPage = meta?.per_page ?? rows.length;
  const canPrevious = page > 1;
  const canNext = pages > 0 && page < pages;

  return (
    <div className="grid gap-3">
      <div className="bg-card ring-1 ring-foreground/10">
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.id} className={column.headerClassName}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-0">
                  {empty ?? (
                    <EmptyState icon={Inbox} title="No records found" />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={getRowId(row)} className={rowClassName?.(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange || onPerPageChange ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? "No records"
              : `${total} record${total === 1 ? "" : "s"} · page ${page} of ${Math.max(pages, 1)}`}
          </p>

          <div className="flex items-center gap-3">
            {onPerPageChange ? (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Rows
                <select
                  className="h-7 border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                  value={perPage || pageSizeOptions[1]}
                  onChange={(event) => onPerPageChange(Number(event.target.value))}
                  aria-label="Rows per page"
                >
                  {pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {onPageChange ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => onPageChange(1)}
                  disabled={!canPrevious || loading}
                  aria-label="First page"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => onPageChange(page - 1)}
                  disabled={!canPrevious || loading}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => onPageChange(page + 1)}
                  disabled={!canNext || loading}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => onPageChange(pages)}
                  disabled={!canNext || loading}
                  aria-label="Last page"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Simple cell wrapper for a title plus optional supporting line. */
export function TableCellStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-0.5", className)}>{children}</div>;
}
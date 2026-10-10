"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { AppBreadcrumbs } from "@/components/app-shell/app-breadcrumbs";
import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";

/**
 * Authenticated application shell (dashboard-01 pattern): collapsible sidebar,
 * sticky header, breadcrumbs, content region.
 *
 * The current user is loaded from the same-origin auth boundary on every mount
 * so role changes take effect immediately. Navigation gating here is only for
 * convenience — Flask remains the authorisation authority.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, error } = useCurrentUser();

  React.useEffect(() => {
    if (!isLoading && (error || !user)) {
      router.replace("/login");
    }
  }, [isLoading, error, user, router]);

  if (isLoading) {
    return <ShellSkeleton />;
  }

  // Redirecting: render nothing so no authorised UI is briefly shown.
  if (error || !user) {
    return <ShellSkeleton />;
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <div className="px-4 pt-3 lg:px-6">
          <AppBreadcrumbs />
        </div>
        <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-64 shrink-0 flex-col gap-3 border-r bg-sidebar p-3 md:flex">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <Skeleton className="size-7" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid gap-1 pt-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-12 border-b" />
        <div className="grid gap-6 p-4 lg:p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { Stethoscope } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center bg-primary text-primary-foreground"
          >
            <Stethoscope className="size-5" />
          </span>
          <div className="grid gap-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight">Meru EMR</h1>
            <p className="text-sm text-muted-foreground">Sign in to your clinical workspace</p>
          </div>
        </div>

        <div className="bg-card p-6 ring-1 ring-foreground/10">
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Staff accounts are created by your system administrator. There is no public
          registration.
        </p>
      </div>
    </main>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="grid gap-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

/** Username/password sign-in form. */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import { loginSchema, type LoginFormValues } from "@/features/auth/schemas/login-schema";

/** Only same-origin relative paths may be used as a post-login destination. */
function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

/** Sign-in form that posts credentials to the auth route, then redirects. */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        // Always generic: the backend must not confirm whether a user exists.
        setFormError(
          payload?.error?.message ?? "Incorrect username or password.",
        );
        return;
      }

      toast.success("Signed in", { description: "Welcome back to the clinical workspace." });
      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch {
      setFormError("Unable to reach the EMR service. Check your connection and try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormField id="username" label="Username" required error={fieldMessage(errors.username)}>
        {(control) => (
          <Input
            {...control}
            {...register("username")}
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. s.nakato"
            disabled={isSubmitting}
            className="h-9"
          />
        )}
      </FormField>

      <FormField id="password" label="Password" required error={fieldMessage(errors.password)}>
        {(control) => (
          <div className="relative">
            <Input
              {...control}
              {...register("password")}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={isSubmitting}
              className="h-9 pr-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        )}
      </FormField>

      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2 border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      <Button type="submit" className="h-9 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            <LogIn className="size-4" />
            Sign in
          </>
        )}
      </Button>
    </form>
  );
}

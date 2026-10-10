/** Create or edit a staff account. */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/shared/select-native";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import {
  USER_ROLES,
  userFormSchema,
  type UserFormValues,
} from "@/features/users/schemas/user-schema";
import { userService } from "@/services/users/user-service";
import { isApiError } from "@/services/http/api-error";
import { humanizeEnum } from "@/lib/formatters";
import type { User } from "@/services/http/api-types";

/** Create or edit a staff account. Presence of `user` switches to edit mode. */
export function UserForm({ user }: { user?: User }) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: user?.username ?? "",
      email: user?.email ?? "",
      full_name: user?.full_name ?? "",
      role: (user?.role ?? "NURSE") as UserFormValues["role"],
      is_active: user?.is_active ?? true,
      password: "",
    },
  });

  async function onSubmit(values: UserFormValues) {
    setFormError(null);

    if (!user) {
      const password = values.password ?? "";
      if (password.length < 8) {
        setError("password", { message: "At least 8 characters" });
        return;
      }
    }

    const payload = {
      username: values.username.trim(),
      email: values.email.trim(),
      full_name: values.full_name.trim(),
      role: values.role,
      is_active: values.is_active,
      ...(user ? {} : { password: values.password }),
    };

    try {
      if (user) {
        await userService.update(user.id, payload);
        toast.success("Account updated");
        router.push("/users");
      } else {
        await userService.create(payload);
        toast.success("Account created");
        router.push("/users");
      }
      router.refresh();
    } catch (error) {
      setFormError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="full_name" label="Full name" required error={fieldMessage(errors.full_name)}>
          {(control) => <Input {...control} {...register("full_name")} autoComplete="off" />}
        </FormField>

        <FormField id="username" label="Username" required error={fieldMessage(errors.username)}>
          {(control) => <Input {...control} {...register("username")} autoComplete="off" />}
        </FormField>

        <FormField id="email" label="Email" required error={fieldMessage(errors.email)}>
          {(control) => <Input {...control} {...register("email")} type="email" autoComplete="off" />}
        </FormField>

        <FormField id="role" label="Role" required error={fieldMessage(errors.role)}>
          {(control) => (
            <SelectNative {...control} {...register("role")}>
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {humanizeEnum(role)}
                </option>
              ))}
            </SelectNative>
          )}
        </FormField>
      </div>

      {!user ? (
        <FormField
          id="password"
          label="Temporary password"
          required
          description="At least 8 characters. The user can change it after signing in."
          error={fieldMessage(errors.password)}
        >
          {(control) => (
            <Input {...control} {...register("password")} type="password" autoComplete="new-password" />
          )}
        </FormField>
      ) : null}

      <Controller
        control={control}
        name="is_active"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-xs font-medium">
            <Checkbox
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(Boolean(checked))}
              aria-label="Account is active"
            />
            Account is active
          </label>
        )}
      />

      {formError ? (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : user ? (
            <Save className="size-4" />
          ) : (
            <UserPlus className="size-4" />
          )}
          {user ? "Save changes" : "Create account"}
        </Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Admin dialog for resetting a staff member's password. */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField, fieldMessage } from "@/components/shared/form-field";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/features/users/schemas/user-schema";
import { userService } from "@/services/users/user-service";
import { isApiError } from "@/services/http/api-error";
import type { User as StaffUser } from "@/services/http/api-types";

/** Admin reset of a staff member's password. */
export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: StaffUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: "" },
  });

  React.useEffect(() => {
    if (open) {
      reset({ new_password: "" });
      setFormError(null);
    }
  }, [open, reset]);

  async function onSubmit(values: ResetPasswordValues) {
    if (!user) return;
    setFormError(null);
    try {
      await userService.resetPassword(user.id, values.new_password);
      toast.success(`Password reset for ${user.username}`);
      onOpenChange(false);
    } catch (error) {
      setFormError(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {user ? `Set a new password for ${user.full_name} (${user.username}).` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <FormField
            id="new_password"
            label="New password"
            required
            description="At least 8 characters."
            error={fieldMessage(errors.new_password)}
          >
            {(control) => (
              <Input {...control} {...register("new_password")} type="password" autoComplete="new-password" />
            )}
          </FormField>

          {formError ? (
            <p role="alert" className="text-xs text-destructive">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

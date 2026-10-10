/** Loads a staff account and renders the prefilled edit form. */
"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { UserForm } from "@/features/users/components/user-form";
import { userService } from "@/services/users/user-service";

/** Loads the account, then renders the prefilled edit form. */
export function EditUser() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { data: user, error, isLoading, mutate } = useSWR(`/users/${userId}`, () =>
    userService.getById(userId),
  );

  if (isLoading) return <LoadingState rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!user) return <ErrorState error={{ status: 404 }} />;

  return (
    <div className="bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
      <UserForm user={user} />
    </div>
  );
}

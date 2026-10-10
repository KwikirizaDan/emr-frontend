/**
 * New user route: create a staff account with a temporary password.
 */
import { PageHeader } from "@/components/shared/page-header";
import { UserForm } from "@/features/users/components/user-form";

export const metadata = {
  title: "New account",
};

/**
 * Renders the create-account form.
 */
export default function NewUserPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="New account"
        description="Create a staff account and set a temporary password."
      />
      <div className="bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
        <UserForm />
      </div>
    </div>
  );
}

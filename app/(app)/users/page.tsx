/**
 * User administration route: staff account management for administrators.
 */
import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "@/features/users/components/users-table";

export const metadata = {
  title: "Users",
};

/**
 * Renders the staff account table.
 */
export default function UsersPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Users"
        description="Staff account management for administrators."
      />
      <UsersTable />
    </div>
  );
}

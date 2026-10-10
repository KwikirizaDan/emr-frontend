import { PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "@/features/users/components/users-table";

export const metadata = {
  title: "Users",
};

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

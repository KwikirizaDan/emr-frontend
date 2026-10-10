/**
 * Edit user route: update a staff account's details, role and status.
 */
import { PageHeader } from "@/components/shared/page-header";
import { EditUser } from "@/features/users/components/edit-user";

export const metadata = {
  title: "Edit account",
};

/**
 * Renders the edit-account form; the id comes from the route segment.
 */
export default function EditUserPage() {
  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        title="Edit account"
        description="Update a staff account's details, role and active status."
      />
      <EditUser />
    </div>
  );
}

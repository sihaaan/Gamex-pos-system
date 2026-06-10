import { redirect } from "next/navigation";
import { AdminUsersShell } from "@/components/admin/admin-users-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminUsersPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "STAFF") {
    return (
      <AccessDenied
        title="Admin is manager-only"
        message="Staff accounts can use the selling screen, but user setup is for managers and owners."
      />
    );
  }

  return <AdminUsersShell />;
}

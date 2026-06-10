import { redirect } from "next/navigation";
import { AdminBranchesShell } from "@/components/admin/admin-branches-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminBranchesPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "STAFF") {
    return (
      <AccessDenied
        title="Admin is manager-only"
        message="Staff accounts can use the selling screen, but branch setup is for managers and owners."
      />
    );
  }

  return <AdminBranchesShell />;
}

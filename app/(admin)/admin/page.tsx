import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "STAFF") {
    return (
      <AccessDenied
        title="Admin is manager-only"
        message="Staff accounts can use the selling screen, but setup and controls are for managers and owners."
      />
    );
  }

  return <AdminShell />;
}

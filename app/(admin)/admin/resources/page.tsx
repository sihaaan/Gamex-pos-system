import { redirect } from "next/navigation";
import { AdminResourcesShell } from "@/components/admin/admin-resources-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminResourcesPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "STAFF") {
    return (
      <AccessDenied
        title="Admin is manager-only"
        message="Staff accounts can use the selling screen, but resources are managed by managers and owners."
      />
    );
  }

  return <AdminResourcesShell />;
}

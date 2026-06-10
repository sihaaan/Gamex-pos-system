import { redirect } from "next/navigation";
import { AdminGstRatesShell } from "@/components/admin/admin-gst-rates-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminGstRatesPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "STAFF") {
    return (
      <AccessDenied
        title="Admin is manager-only"
        message="Staff accounts can use the selling screen, but GST setup is managed by managers and owners."
      />
    );
  }

  return <AdminGstRatesShell />;
}

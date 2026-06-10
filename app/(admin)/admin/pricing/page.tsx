import { redirect } from "next/navigation";
import { AdminPricingShell } from "@/components/admin/admin-pricing-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminPricingPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "STAFF") {
    return (
      <AccessDenied
        title="Admin is manager-only"
        message="Staff accounts can use the selling screen, but timed service pricing is managed by managers and owners."
      />
    );
  }

  return <AdminPricingShell />;
}

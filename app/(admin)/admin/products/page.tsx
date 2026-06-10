import { redirect } from "next/navigation";
import { AdminProductsShell } from "@/components/admin/admin-products-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminProductsPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "STAFF") {
    return (
      <AccessDenied
        title="Admin is manager-only"
        message="Staff accounts can use the selling screen, but products and stock are managed by managers and owners."
      />
    );
  }

  return <AdminProductsShell />;
}

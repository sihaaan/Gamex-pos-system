import { redirect } from "next/navigation";
import { AdminFloorMapShell } from "@/components/admin/admin-floor-map-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminFloorMapPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "STAFF") {
    return (
      <AccessDenied
        title="Admin is manager-only"
        message="Staff accounts can use the selling screen, but the floor map is managed by managers and owners."
      />
    );
  }

  return <AdminFloorMapShell />;
}

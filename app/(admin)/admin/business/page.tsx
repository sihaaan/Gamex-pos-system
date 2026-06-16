import { redirect } from "next/navigation";
import { AdminBusinessShell } from "@/components/admin/admin-business-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminBusinessPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role !== "OWNER") {
    return (
      <AccessDenied
        title="Owner-only setup"
        message="Legal entity details are owner-only because they affect future GST invoice snapshots."
      />
    );
  }

  return <AdminBusinessShell />;
}

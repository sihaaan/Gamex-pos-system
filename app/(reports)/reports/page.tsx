import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/auth/access-denied";
import { ShiftReport } from "@/components/reports/shift-report";
import { getAuthContext } from "@/lib/auth/session";

export default async function ReportsPage() {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  if (auth.role === "STAFF") {
    return (
      <AccessDenied
        title="Reports are manager-only"
        message="Staff accounts can sell from POS, but reports are visible to managers and owners."
      />
    );
  }

  return <ShiftReport />;
}

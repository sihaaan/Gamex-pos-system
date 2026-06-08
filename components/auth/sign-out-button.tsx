"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button
      className="min-h-9 px-3"
      disabled={pending}
      onClick={signOut}
      variant="ghost"
    >
      <LogOut className="h-4 w-4" />
      {pending ? "Signing out" : "Sign out"}
    </Button>
  );
}

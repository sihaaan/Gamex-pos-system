"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) {
      return;
    }

    setPending(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      });
    } finally {
      window.location.replace("/login");
    }
  }

  return (
    <Button
      className="min-h-9 px-3 text-nav-ink-muted hover:bg-white/10 hover:text-nav-ink focus-visible:ring-brand/60 focus-visible:ring-offset-nav"
      disabled={pending}
      onClick={signOut}
      variant="ghost"
    >
      <LogOut className="h-4 w-4" />
      {pending ? "Signing out" : "Sign out"}
    </Button>
  );
}

"use client";

import { Printer } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function PrintButton({
  children = "Print",
}: {
  children?: ReactNode;
}) {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {children}
    </Button>
  );
}

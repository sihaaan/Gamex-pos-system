import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AccessDenied({
  title = "Access denied",
  message = "This area is for managers and owners.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-10">
      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-900">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-2 text-sm text-zinc-600">{message}</p>
        </div>
        <Button asChild>
          <Link href="/pos">Back to POS</Link>
        </Button>
      </section>
    </main>
  );
}

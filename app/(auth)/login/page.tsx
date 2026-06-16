import { Gamepad2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-md place-items-center px-4 py-10">
      <section className="w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="brand-gradient flex items-center gap-3 px-6 py-5 text-white">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Gamepad2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              GameX POS
            </p>
            <h1 className="text-xl font-bold tracking-tight">
              Sign in to the counter
            </h1>
          </div>
        </div>
        <div className="p-6">
          <p className="mb-5 text-sm text-ink-muted">
            Enter your operator credentials to open the selling counter.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

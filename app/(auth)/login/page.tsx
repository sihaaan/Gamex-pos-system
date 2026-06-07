import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-md place-items-center px-4 py-10">
      <section className="w-full rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold text-emerald-700">GameX POS</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal">
            Sign in to the counter
          </h1>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}

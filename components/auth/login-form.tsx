"use client";

import { AlertCircle, Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage("Checking credentials...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(payload?.error?.message ?? "Invalid email or password.");
        setStatusMessage(null);
        setLoading(false);
        return;
      }

      setStatusMessage("Opening counter...");

      const sessionResponse = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!sessionResponse.ok) {
        setError("Sign-in was not confirmed. Please try again.");
        setStatusMessage(null);
        setLoading(false);
        return;
      }

      window.location.assign("/pos");
    } catch {
      setError("Connection error. Check the network and try again.");
      setStatusMessage(null);
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-1.5 text-sm font-medium text-ink-muted">
        Email
        <Input
          autoComplete="email"
          autoFocus
          inputMode="email"
          required
          type="email"
          value={email}
          disabled={loading}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-ink-muted">
        Password
        <div className="relative">
          <Input
            autoComplete="current-password"
            className="pr-11"
            required
            type={showPassword ? "text" : "password"}
            value={password}
            disabled={loading}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-lg text-ink-subtle transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            disabled={loading}
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </label>
      {error ? (
        <p
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm font-medium text-danger-ink"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}
      {statusMessage ? (
        <p
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-brand/25 bg-brand-soft px-3 py-2 text-sm font-medium text-brand-strong"
          role="status"
        >
          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
          {statusMessage}
        </p>
      ) : null}
      <Button className="min-h-12 text-base" type="submit" disabled={loading}>
        {loading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}

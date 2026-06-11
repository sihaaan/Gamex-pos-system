import { describe, expect, it } from "vitest";
import { validateAppEnv } from "@/lib/env";

describe("environment validation", () => {
  it("allows development without a session secret", () => {
    const result = validateAppEnv({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://gamex:password@localhost:5432/gamex_pos",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.sessionIdleTimeoutMs).toBe(8 * 60 * 60 * 1000);
      expect(result.env.sessionAbsoluteTimeoutMs).toBe(14 * 24 * 60 * 60 * 1000);
    }
  });

  it("rejects a missing production session secret", () => {
    const result = validateAppEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://gamex:password@localhost:5432/gamex_pos",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain("SESSION_SECRET is required.");
    }
  });

  it("rejects a weak production session secret", () => {
    const result = validateAppEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://gamex:password@localhost:5432/gamex_pos",
      SESSION_SECRET: "Gamex@12345-default-password-secret",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(" ")).toContain("SESSION_SECRET must be");
    }
  });

  it("accepts a strong production session secret", () => {
    const result = validateAppEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://gamex:password@localhost:5432/gamex_pos",
      SESSION_SECRET: "A1!bcdefghijklmnopqrstuvwxyzABCDE",
      NEXT_PUBLIC_APP_URL: "https://pos.example.com",
    });

    expect(result.ok).toBe(true);
  });
});

export type RuntimeEnv = "development" | "test" | "production";

export type ValidatedEnv = {
  nodeEnv: RuntimeEnv;
  databaseUrl: string;
  sessionSecret?: string;
  nextPublicAppUrl?: string;
  managerDiscountLimitPercent: number;
  sessionIdleTimeoutMs: number;
  sessionAbsoluteTimeoutMs: number;
};

export type EnvValidationResult =
  | { ok: true; env: ValidatedEnv }
  | { ok: false; issues: string[] };

const runtimeEnvs = ["development", "test", "production"] as const;
const defaultIdleTimeoutMs = 8 * 60 * 60 * 1000;
const defaultAbsoluteTimeoutMs = 14 * 24 * 60 * 60 * 1000;

export function validateAppEnv(
  input: Record<string, string | undefined>,
): EnvValidationResult {
  const issues: string[] = [];
  const nodeEnv = parseNodeEnv(input.NODE_ENV, issues);
  const databaseUrl = required(input.DATABASE_URL, "DATABASE_URL", issues);
  const managerDiscountLimitPercent = parseIntegerEnv(
    input.MANAGER_DISCOUNT_LIMIT_PERCENT,
    "MANAGER_DISCOUNT_LIMIT_PERCENT",
    10,
    issues,
    { min: 0, max: 100 },
  );
  const sessionIdleTimeoutMs = parseIntegerEnv(
    input.SESSION_IDLE_TIMEOUT_MS,
    "SESSION_IDLE_TIMEOUT_MS",
    defaultIdleTimeoutMs,
    issues,
    { min: 60_000 },
  );
  const sessionAbsoluteTimeoutMs = parseIntegerEnv(
    input.SESSION_ABSOLUTE_TIMEOUT_MS,
    "SESSION_ABSOLUTE_TIMEOUT_MS",
    defaultAbsoluteTimeoutMs,
    issues,
    { min: 60_000 },
  );
  const nextPublicAppUrl = optionalUrl(
    input.NEXT_PUBLIC_APP_URL,
    "NEXT_PUBLIC_APP_URL",
    issues,
    nodeEnv,
  );

  if (nodeEnv === "production") {
    const sessionSecret = required(input.SESSION_SECRET, "SESSION_SECRET", issues);
    if (sessionSecret && !isStrongProductionSecret(sessionSecret)) {
      issues.push(
        "SESSION_SECRET must be at least 32 characters, non-obvious, and contain mixed character classes in production.",
      );
    }
  }

  if (sessionAbsoluteTimeoutMs < sessionIdleTimeoutMs) {
    issues.push(
      "SESSION_ABSOLUTE_TIMEOUT_MS must be greater than or equal to SESSION_IDLE_TIMEOUT_MS.",
    );
  }

  if (issues.length > 0 || !databaseUrl) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    env: {
      nodeEnv,
      databaseUrl,
      sessionSecret: input.SESSION_SECRET,
      nextPublicAppUrl,
      managerDiscountLimitPercent,
      sessionIdleTimeoutMs,
      sessionAbsoluteTimeoutMs,
    },
  };
}

export function assertAppEnv(
  input: Record<string, string | undefined> = process.env,
): ValidatedEnv {
  const result = validateAppEnv(input);
  if (result.ok) {
    return result.env;
  }

  throw new Error(`Invalid environment: ${result.issues.join(" ")}`);
}

export function sessionTimeoutsFromEnv(
  input: Record<string, string | undefined> = process.env,
): { idleTimeoutMs: number; absoluteTimeoutMs: number } {
  const result = validateAppEnv({
    ...input,
    DATABASE_URL: input.DATABASE_URL ?? "postgresql://dev-placeholder",
  });

  if (!result.ok) {
    return {
      idleTimeoutMs: defaultIdleTimeoutMs,
      absoluteTimeoutMs: defaultAbsoluteTimeoutMs,
    };
  }

  return {
    idleTimeoutMs: result.env.sessionIdleTimeoutMs,
    absoluteTimeoutMs: result.env.sessionAbsoluteTimeoutMs,
  };
}

export function isStrongProductionSecret(secret: string): boolean {
  if (secret.length < 32) {
    return false;
  }

  const lower = secret.toLowerCase();
  const weakFragments = [
    "changeme",
    "default",
    "demo",
    "gamex",
    "password",
    "secret",
    "test",
  ];

  if (weakFragments.some((fragment) => lower.includes(fragment))) {
    return false;
  }

  const classes = [
    /[a-z]/.test(secret),
    /[A-Z]/.test(secret),
    /[0-9]/.test(secret),
    /[^a-zA-Z0-9]/.test(secret),
  ].filter(Boolean).length;

  return classes >= 3;
}

function parseNodeEnv(
  value: string | undefined,
  issues: string[],
): RuntimeEnv {
  if (!value) {
    return "development";
  }

  if (runtimeEnvs.includes(value as RuntimeEnv)) {
    return value as RuntimeEnv;
  }

  issues.push("NODE_ENV must be development, test, or production.");
  return "development";
}

function required(
  value: string | undefined,
  name: string,
  issues: string[],
): string | undefined {
  if (!value || value.trim().length === 0) {
    issues.push(`${name} is required.`);
    return undefined;
  }

  return value;
}

function parseIntegerEnv(
  value: string | undefined,
  name: string,
  fallback: number,
  issues: string[],
  bounds: { min?: number; max?: number },
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    issues.push(`${name} must be an integer.`);
    return fallback;
  }

  if (bounds.min !== undefined && parsed < bounds.min) {
    issues.push(`${name} must be at least ${bounds.min}.`);
  }

  if (bounds.max !== undefined && parsed > bounds.max) {
    issues.push(`${name} must be at most ${bounds.max}.`);
  }

  return parsed;
}

function optionalUrl(
  value: string | undefined,
  name: string,
  issues: string[],
  nodeEnv: RuntimeEnv,
): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (nodeEnv === "production" && url.protocol !== "https:") {
      issues.push(`${name} must use https:// in production.`);
    }
    return url.toString();
  } catch {
    issues.push(`${name} must be a valid URL.`);
    return undefined;
  }
}

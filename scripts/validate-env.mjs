import "dotenv/config";

const runtimeEnvs = new Set(["development", "test", "production"]);

const weakSecretFragments = [
  "changeme",
  "default",
  "demo",
  "gamex",
  "password",
  "secret",
  "test",
];

const issues = [];

function issue(message) {
  issues.push(message);
}

function isStrongProductionSecret(secret) {
  if (secret.length < 32) {
    return false;
  }

  const lower = secret.toLowerCase();
  if (weakSecretFragments.some((fragment) => lower.includes(fragment))) {
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

function integerEnv(name, fallback, bounds) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    issue(`${name} must be an integer.`);
    return fallback;
  }

  if (bounds.min !== undefined && parsed < bounds.min) {
    issue(`${name} must be at least ${bounds.min}.`);
  }

  if (bounds.max !== undefined && parsed > bounds.max) {
    issue(`${name} must be at most ${bounds.max}.`);
  }

  return parsed;
}

const nodeEnv = process.env.NODE_ENV ?? "development";

if (!runtimeEnvs.has(nodeEnv)) {
  issue("NODE_ENV must be development, test, or production.");
}

if (!process.env.DATABASE_URL) {
  issue("DATABASE_URL is required.");
}

const idleTimeoutMs = integerEnv("SESSION_IDLE_TIMEOUT_MS", 8 * 60 * 60 * 1000, {
  min: 60_000,
});
const absoluteTimeoutMs = integerEnv(
  "SESSION_ABSOLUTE_TIMEOUT_MS",
  14 * 24 * 60 * 60 * 1000,
  { min: 60_000 },
);

if (absoluteTimeoutMs < idleTimeoutMs) {
  issue("SESSION_ABSOLUTE_TIMEOUT_MS must be greater than or equal to SESSION_IDLE_TIMEOUT_MS.");
}

integerEnv("MANAGER_DISCOUNT_LIMIT_PERCENT", 10, { min: 0, max: 100 });

if (process.env.NEXT_PUBLIC_APP_URL) {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_APP_URL);
    if (nodeEnv === "production" && url.protocol !== "https:") {
      issue("NEXT_PUBLIC_APP_URL must use https:// in production.");
    }
  } catch {
    issue("NEXT_PUBLIC_APP_URL must be a valid URL.");
  }
}

if (nodeEnv === "production") {
  if (!process.env.SESSION_SECRET) {
    issue("SESSION_SECRET is required.");
  } else if (!isStrongProductionSecret(process.env.SESSION_SECRET)) {
    issue(
      "SESSION_SECRET must be at least 32 characters, non-obvious, and contain mixed character classes in production.",
    );
  }
}

if (issues.length > 0) {
  console.error("Environment validation failed:");
  for (const message of issues) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("Environment validation passed.");

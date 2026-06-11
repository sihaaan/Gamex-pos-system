import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/auth/password";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const requiredVars = [
  "BOOTSTRAP_LEGAL_ENTITY_NAME",
  "BOOTSTRAP_GSTIN",
  "BOOTSTRAP_LEGAL_ENTITY_ADDRESS",
  "BOOTSTRAP_STATE_CODE",
  "BOOTSTRAP_BRANCH_NAME",
  "BOOTSTRAP_BRANCH_CODE",
  "BOOTSTRAP_BRANCH_ADDRESS",
  "BOOTSTRAP_OWNER_NAME",
  "BOOTSTRAP_OWNER_EMAIL",
  "BOOTSTRAP_OWNER_PASSWORD",
] as const;

function env(name: (typeof requiredVars)[number]): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function assertStrongBootstrapPassword(password: string): void {
  const lower = password.toLowerCase();
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;

  if (
    password.length < 12 ||
    classes < 3 ||
    lower.includes("gamex") ||
    lower.includes("password") ||
    lower.includes("default")
  ) {
    throw new Error(
      "BOOTSTRAP_OWNER_PASSWORD must be at least 12 characters, non-default, and use mixed character classes.",
    );
  }
}

async function main() {
  for (const name of requiredVars) {
    env(name);
  }

  const ownerPassword = env("BOOTSTRAP_OWNER_PASSWORD");
  assertStrongBootstrapPassword(ownerPassword);
  const passwordHash = await hashPassword(ownerPassword);

  const ownerEmail = env("BOOTSTRAP_OWNER_EMAIL").toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("A user with BOOTSTRAP_OWNER_EMAIL already exists.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const legalEntity = await tx.legalEntity.create({
      data: {
        name: env("BOOTSTRAP_LEGAL_ENTITY_NAME"),
        gstin: env("BOOTSTRAP_GSTIN"),
        address: env("BOOTSTRAP_LEGAL_ENTITY_ADDRESS"),
        stateCode: env("BOOTSTRAP_STATE_CODE"),
      },
      select: { id: true, name: true },
    });

    const branch = await tx.branch.create({
      data: {
        legalEntityId: legalEntity.id,
        name: env("BOOTSTRAP_BRANCH_NAME"),
        code: env("BOOTSTRAP_BRANCH_CODE"),
        address: env("BOOTSTRAP_BRANCH_ADDRESS"),
        stateCode:
          process.env.BOOTSTRAP_BRANCH_STATE_CODE?.trim() ||
          env("BOOTSTRAP_STATE_CODE"),
      },
      select: { id: true, name: true },
    });

    const owner = await tx.user.create({
      data: {
        legalEntityId: legalEntity.id,
        branchId: null,
        email: ownerEmail,
        name: env("BOOTSTRAP_OWNER_NAME"),
        role: "OWNER",
        passwordHash,
      },
      select: { id: true, email: true },
    });

    return { legalEntity, branch, owner };
  });

  console.log("Production bootstrap complete.");
  console.log(`Legal entity: ${result.legalEntity.name}`);
  console.log(`Branch: ${result.branch.name}`);
  console.log(`Owner email: ${result.owner.email}`);
  console.log("Sign in and immediately rotate this password after first login.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Bootstrap failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

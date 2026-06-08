import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/auth/password";
import { compactFinancialYear } from "../lib/gst/invoice-number";
import type { UserRole } from "../lib/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const defaultPassword = "Gamex@12345";

async function main() {
  const passwordHash = await hashPassword(defaultPassword);
  const financialYear = compactFinancialYear(new Date());

  const entities = [
    {
      code: "GX",
      name: "GameX Bengaluru LLP",
      gstin: "29ABCDE1234F1Z5",
      address: "Indiranagar, Bengaluru, Karnataka",
      stateCode: "29",
    },
    {
      code: "AG",
      name: "ArenaCue Gaming LLP",
      gstin: "29PQRSX5678K1Z2",
      address: "Koramangala, Bengaluru, Karnataka",
      stateCode: "29",
    },
  ];

  for (const entityInput of entities) {
    const entity = await prisma.legalEntity.upsert({
      where: { gstin: entityInput.gstin },
      update: {
        name: entityInput.name,
        address: entityInput.address,
        stateCode: entityInput.stateCode,
      },
      create: {
        name: entityInput.name,
        gstin: entityInput.gstin,
        address: entityInput.address,
        stateCode: entityInput.stateCode,
      },
    });

    const branches = await Promise.all(
      ["A01", "A02", "A03"].map((code, index) =>
        prisma.branch.upsert({
          where: {
            legalEntityId_code: {
              legalEntityId: entity.id,
              code,
            },
          },
          update: {
            name: `${entityInput.code} Branch ${index + 1}`,
            address: `Bengaluru branch ${index + 1}, Karnataka`,
          },
          create: {
            legalEntityId: entity.id,
            code,
            name: `${entityInput.code} Branch ${index + 1}`,
            address: `Bengaluru branch ${index + 1}, Karnataka`,
            stateCode: "29",
          },
        }),
      ),
    );

    await seedUsers(entity.id, branches[0].id, passwordHash, entityInput.code);
    await seedRolePermissions(entity.id);
    await seedDiscountRules(entity.id);
    const sac = await ensureTaxRate(entity.id, "9996", "SAC", "Recreation services", 18);
    const beverages = await ensureTaxRate(entity.id, "2202", "HSN", "Beverages", 18);
    const snacks = await ensureTaxRate(entity.id, "2106", "HSN", "Prepared snacks", 18);
    const pricing = await prisma.pricingRule.upsert({
      where: {
        legalEntityId_name: {
          legalEntityId: entity.id,
          name: "Standard minute prorated",
        },
      },
      update: {
        ratePerMinute: 500,
        minimumBillableMinutes: 10,
        roundUpToMinutes: 5,
        managerDiscountLimitPercent: 10,
      },
      create: {
        legalEntityId: entity.id,
        name: "Standard minute prorated",
        ratePerMinute: 500,
        minimumBillableMinutes: 10,
        roundUpToMinutes: 5,
        managerDiscountLimitPercent: 10,
      },
    });

    await ensureService(entity.id, sac.id, pricing.id, "Pool table", "Pool table timed play", "9996");
    await ensureService(entity.id, sac.id, pricing.id, "PS5 console", "PS5 console timed play", "9996");

    for (const branch of branches) {
      await seedBranchResources(entity.id, branch.id);
      await ensureProduct(entity.id, branch.id, beverages.id, "COKE-300", "Cold drink", "2202", 6000, 48);
      await ensureProduct(entity.id, branch.id, snacks.id, "CHIPS-60", "Chips pack", "2106", 3000, 60);
      await prisma.invoiceSeries.upsert({
        where: {
          legalEntityId_branchId_financialYear_prefix: {
            legalEntityId: entity.id,
            branchId: branch.id,
            financialYear,
            prefix: `${entityInput.code}${branch.code}${financialYear}`,
          },
        },
        update: { isActive: true },
        create: {
          legalEntityId: entity.id,
          branchId: branch.id,
          financialYear,
          prefix: `${entityInput.code}${branch.code}${financialYear}`,
          nextNumber: 1,
        },
      });
    }

    await seedJournalAccounts(entity.id);
  }

  console.log(`Seed complete. Default password: ${defaultPassword}`);
}

async function seedDiscountRules(legalEntityId: string) {
  const existing = await prisma.discountRule.findFirst({
    where: {
      legalEntityId,
      branchId: null,
      name: "Happy Hour",
    },
  });
  const data = {
    discountPercent: 30,
    minimumBillableMinutes: 60,
    daysOfWeek: [1, 2],
    startMinuteOfDay: 10 * 60,
    endMinuteOfDay: 17 * 60,
    isActive: true,
  };

  if (existing) {
    await prisma.discountRule.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.discountRule.create({
    data: {
      legalEntityId,
      branchId: null,
      name: "Happy Hour",
      ...data,
    },
  });
}

async function seedUsers(
  legalEntityId: string,
  branchId: string,
  passwordHash: string,
  code: string,
) {
  const users: Array<{
    role: UserRole;
    name: string;
    email: string;
    branchId: string | null;
  }> = [
    {
      role: "OWNER",
      name: `${code} Owner`,
      email: `${code.toLowerCase()}-owner@gamex.local`,
      branchId: null,
    },
    {
      role: "MANAGER",
      name: `${code} Manager`,
      email: `${code.toLowerCase()}-manager@gamex.local`,
      branchId,
    },
    {
      role: "STAFF",
      name: `${code} Staff`,
      email: `${code.toLowerCase()}-staff@gamex.local`,
      branchId,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        passwordHash,
        isActive: true,
      },
      create: {
        legalEntityId,
        branchId: user.branchId,
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
  }
}

async function seedRolePermissions(legalEntityId: string) {
  const permissions = [
    "shift:open",
    "shift:close",
    "shift:reopen",
    "tab:write",
    "tab:checkout",
    "tab:void",
    "refund:create",
    "catalog:write",
    "stock:adjust",
    "reports:read",
  ];

  for (const role of ["STAFF", "MANAGER", "OWNER"] as const) {
    for (const permission of permissions) {
      const staffAllowed = [
        "shift:open",
        "shift:close",
        "tab:write",
        "tab:checkout",
      ].includes(permission);
      await prisma.rolePermission.upsert({
        where: {
          legalEntityId_role_permission: {
            legalEntityId,
            role,
            permission,
          },
        },
        update: { allowed: role === "STAFF" ? staffAllowed : true },
        create: {
          legalEntityId,
          role,
          permission,
          allowed: role === "STAFF" ? staffAllowed : true,
        },
      });
    }
  }
}

async function ensureTaxRate(
  legalEntityId: string,
  code: string,
  kind: "HSN" | "SAC",
  description: string,
  gstRate: number,
) {
  const existing = await prisma.taxRate.findFirst({
    where: { legalEntityId, code, kind, effectiveTo: null },
  });
  if (existing) {
    return existing;
  }

  return prisma.taxRate.create({
    data: {
      legalEntityId,
      code,
      kind,
      description,
      gstRate,
      effectiveFrom: new Date("2024-04-01T00:00:00.000Z"),
    },
  });
}

async function ensureService(
  legalEntityId: string,
  taxRateId: string,
  pricingRuleId: string,
  name: string,
  description: string,
  sacCode: string,
) {
  const existing = await prisma.serviceCatalog.findFirst({
    where: { legalEntityId, branchId: null, name },
  });
  if (existing) {
    return existing;
  }

  return prisma.serviceCatalog.create({
    data: {
      legalEntityId,
      taxRateId,
      pricingRuleId,
      name,
      description,
      sacCode,
    },
  });
}

async function ensureProduct(
  legalEntityId: string,
  branchId: string,
  taxRateId: string,
  sku: string,
  name: string,
  hsnCode: string,
  unitPrice: number,
  stockQuantity: number,
) {
  const existing = await prisma.productCatalog.findFirst({
    where: { legalEntityId, branchId, sku },
  });
  if (existing) {
    return prisma.productCatalog.update({
      where: { id: existing.id },
      data: { name, hsnCode, unitPrice, stockQuantity, taxRateId },
    });
  }

  return prisma.productCatalog.create({
    data: {
      legalEntityId,
      branchId,
      taxRateId,
      sku,
      name,
      hsnCode,
      unitPrice,
      stockQuantity,
      lowStockThreshold: 10,
    },
  });
}

async function seedBranchResources(legalEntityId: string, branchId: string) {
  const resources = [
    ["Pool 1", "POOL_TABLE"],
    ["Pool 2", "POOL_TABLE"],
    ["PS5 1", "CONSOLE"],
    ["PS5 2", "CONSOLE"],
  ] as const;

  for (const [name, kind] of resources) {
    await prisma.resource.upsert({
      where: {
        legalEntityId_branchId_name: {
          legalEntityId,
          branchId,
          name,
        },
      },
      update: { kind, isActive: true },
      create: {
        legalEntityId,
        branchId,
        name,
        kind,
      },
    });
  }
}

async function seedJournalAccounts(legalEntityId: string) {
  const accounts = [
    ["1000", "Cash and payment clearing"],
    ["4000", "POS sales revenue"],
    ["2100", "CGST payable"],
    ["2110", "SGST payable"],
    ["2120", "IGST payable"],
  ] as const;

  for (const [code, name] of accounts) {
    await prisma.journalAccount.upsert({
      where: { legalEntityId_code: { legalEntityId, code } },
      update: { name },
      create: { legalEntityId, code, name },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

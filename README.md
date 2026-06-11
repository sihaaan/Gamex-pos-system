# GameX POS

Production-grade, online-first POS MVP for GST-registered pool and gaming shops. The system is POS-first: operator shifts, running tabs, timed services, retail sales, GST invoices, refunds/credit notes, basic stock, reports, and a hidden double-entry journal engine.

## Stack

- Next.js App Router with TypeScript strict mode
- PostgreSQL with Prisma
- Zod request validation
- Tailwind CSS with shadcn-style local UI primitives
- Secure HttpOnly cookie sessions with Argon2id password hashing
- Vitest and Playwright
- Docker and Docker Compose
- Installable PWA shell with provisional offline draft storage

## Local Setup

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The development seed creates demo legal entities, branches, owner/manager/staff users, resources, products, pricing, GST rates, invoice series, and chart-of-accounts rows. It is for local/demo use only.

Demo seeded users use this local-only password:

```txt
Gamex@12345
```

Do not use demo users or demo passwords in production.

## Environment

Required:

```txt
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host:5432/gamex_pos?schema=public
```

Required in production:

```txt
NODE_ENV=production
SESSION_SECRET=<strong random secret>
```

Optional:

```txt
NEXT_PUBLIC_APP_URL=https://pos.example.com
MANAGER_DISCOUNT_LIMIT_PERCENT=10
SESSION_IDLE_TIMEOUT_MS=28800000
SESSION_ABSOLUTE_TIMEOUT_MS=1209600000
```

Generate a production `SESSION_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Validate environment variables:

```bash
npm run env:check
```

Validation rejects missing production secrets, weak production `SESSION_SECRET` values, invalid timeout values, and non-HTTPS `NEXT_PUBLIC_APP_URL` values in production. Secret values are never printed.

## Database

Generate Prisma client:

```bash
npm run db:generate
```

Create local migrations:

```bash
npm run db:migrate
```

Apply migrations in production:

```bash
npm run db:deploy
```

Seed development data only:

```bash
npm run db:seed
```

## Production Bootstrap

For production, do not run `npm run db:seed`. After migrations, create the first real legal entity, branch, and owner with:

```bash
BOOTSTRAP_LEGAL_ENTITY_NAME="Real Business Name" \
BOOTSTRAP_GSTIN="29XXXXXXXXXXZX" \
BOOTSTRAP_LEGAL_ENTITY_ADDRESS="Registered address" \
BOOTSTRAP_STATE_CODE="29" \
BOOTSTRAP_BRANCH_NAME="Main Branch" \
BOOTSTRAP_BRANCH_CODE="B01" \
BOOTSTRAP_BRANCH_ADDRESS="Branch address" \
BOOTSTRAP_OWNER_NAME="Owner Name" \
BOOTSTRAP_OWNER_EMAIL="owner@example.com" \
BOOTSTRAP_OWNER_PASSWORD="<strong temporary password>" \
npm run bootstrap:owner
```

Then sign in as the owner, rotate the temporary password, and configure real resources, products, pricing, GST rates, invoice series, users, and branch settings from Admin.

## Docker

Local Docker:

```bash
docker compose up --build
```

Production-style example:

```bash
docker compose -f docker-compose.prod.example.yml up --build -d
```

The container entrypoint runs:

```bash
node scripts/validate-env.mjs
npx prisma migrate deploy
node server.js
```

Health check:

```bash
curl http://localhost:3000/api/health
```

The expected response includes `{"status":"ok","service":"gamex-pos"}`.

## Production Deploy

Use one Dockerized Next.js service and one managed PostgreSQL database.

Minimum deployment flow:

1. Provision PostgreSQL and restrict network access.
2. Set production env vars in the hosting platform, not in source control.
3. Build the Docker image.
4. Run `npm run env:check`.
5. Run `npx prisma migrate deploy`.
6. Run `npm run bootstrap:owner` once for the first real tenant.
7. Start the web service.
8. Check `/api/health`.
9. Confirm HTTPS and secure cookies.
10. Configure daily database backups and test restore.

See [Production Readiness](docs/production-readiness.md), [Backup and Restore](docs/backup-restore.md), [Security Checklist](docs/security-checklist.md), and [Pilot Checklist](docs/pilot-checklist.md).

## Tests

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e -- --project=chromium
```

Unit tests cover pricing, GST, invoice numbering, event-based duration, journals, shift summaries, tenant isolation, offline policy, env validation, and error response safety. Integration-style tests cover start/stop/checkout and refund reversal logic.

## Operator Shift Workflow

1. Staff signs in.
2. Staff opens an operator shift at the branch.
3. Staff creates running tabs, starts/stops timed sessions, adds retail items, and records payments.
4. Checkout posts GST invoice, payment rows, stock movements, audit logs, and hidden journal entries in one server transaction.
5. Staff closes the shift.
6. Shift close summary shows gross sales, discounts, refunds, voids, net sales, GST collected, tender totals, active-tab warnings, and unusual actions.

There is no heavy cash drawer system in v1. Optional opening float and counted cash fields exist only for accountability.

## Offline Rules

This is an online-first PWA. Offline support is provisional:

- App shell can be cached.
- Online/offline status is shown.
- Draft UI actions can be saved in IndexedDB.
- Drafts are clearly marked `Draft / Not Posted`.

Offline mode must not post official billing actions. Final checkout, GST invoice numbers, payment posting, journal posting, refund posting, credit note posting, final shift close, and official timed session events require server confirmation and server timestamps.

## GST Notes

Invoices and invoice lines are immutable snapshots. Posted invoices are not recalculated from current product, service, pricing, or tax tables. Refunds and corrections create credit notes, refund payments, and reversing journal entries.

Confirm exact GST classification, invoice series policy, e-invoicing applicability, invoice format, rounding, and credit-note treatment with the shop's CA before production go-live.

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

## Setup

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

Default seeded password:

```txt
Gamex@12345
```

Seeded users include owner, manager, and staff accounts for each sample legal entity, such as `gx-staff@gamex.local` and `ag-staff@gamex.local`.

## Environment

```txt
DATABASE_URL=postgresql://user:password@host:5432/gamex_pos?schema=public
MANAGER_DISCOUNT_LIMIT_PERCENT=10
```

Use PostgreSQL in all environments. Do not use SQLite for production or billing tests.

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

Seed development data:

```bash
npm run db:seed
```

## Tests

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

Unit tests cover pricing, GST, invoice numbering, event-based duration, journals, shift summaries, tenant isolation, and offline policy. Integration-style tests cover start/stop/checkout and refund reversal logic.

## Docker

Local Docker deployment:

```bash
docker compose up --build
```

The web container runs `prisma migrate deploy` before starting Next.js.

## Production Deploy

Use one Dockerized Next.js service and one managed PostgreSQL database. Set `DATABASE_URL`, run migrations during deployment, enable HTTPS, and configure automated database backups.

Recommended minimum production controls:

- Daily PostgreSQL backups with restore drills
- HTTPS only
- `NODE_ENV=production`
- secure cookie transport
- restricted database network access
- log retention for audit review
- manager/owner MFA rollout when ready

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

Confirm exact GST classification, invoice series policy, e-invoicing applicability, and credit-note treatment with the shop's CA before production go-live.

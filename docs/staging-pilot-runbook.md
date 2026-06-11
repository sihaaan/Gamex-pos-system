# Staging Pilot Runbook

Use this runbook to deploy `rc-pilot-1` to a staging or production-like environment, configure one real branch, and run the manual pilot rehearsal without guessing.

This is an operator checklist. Do not run demo seed data in staging if the staging database will be used for real pilot decisions.

## Before You Start

Have these ready:

- Server or hosting environment with HTTPS available.
- PostgreSQL database URL.
- Domain or staging URL.
- Legal entity name, GSTIN, registered address, and state code.
- Branch name, branch code, address, and state code.
- Owner email and strong temporary password.
- Pool table names.
- PS5/console names.
- Timed rates for Pool and PS5.
- Product list for snacks/drinks with prices, HSN codes, GST rates, and starting stock.
- Invoice series prefix for the branch.
- Backup storage location.

Do not commit `.env`, passwords, database URLs, backup files, or production secrets.

## Step 1: Prepare Server/Environment

Required:

- Node.js 22
- npm
- PostgreSQL 16 or managed PostgreSQL
- Git
- Browser for POS use
- HTTPS for any real staging/pilot URL

Optional Docker path:

- Docker
- Docker Compose

Clone and enter the repo:

```bash
git clone https://github.com/sihaaan/Gamex-pos-system.git
cd Gamex-pos-system
git checkout rc-pilot-1
```

Install dependencies for the non-Docker path:

```bash
npm ci
npm run db:generate
```

## Step 2: Set Production-Like Env Vars

Create a server-side `.env` file or configure these in the hosting secret manager:

```txt
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/gamex_pos?schema=public
SESSION_SECRET=<strong random secret>
NEXT_PUBLIC_APP_URL=https://staging.example.com
MANAGER_DISCOUNT_LIMIT_PERCENT=10
SESSION_IDLE_TIMEOUT_MS=28800000
SESSION_ABSOLUTE_TIMEOUT_MS=1209600000
```

Generate `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Validate env:

```bash
npm run env:check
```

Expected result:

```txt
Environment validation passed.
```

If validation fails, fix the named env var. The validator does not print secret values.

## Step 3: Run Migrations

Non-Docker path:

```bash
npm run build
npm run db:deploy
```

Docker path:

```bash
docker compose -f docker-compose.prod.example.yml up --build -d
docker compose -f docker-compose.prod.example.yml logs -f web
```

The Docker entrypoint runs env validation, Prisma migrations, and the Next.js server start.

## Step 4: Create First Owner/Legal Entity/Branch

Do not run `npm run db:seed` for staging or production pilot data.

PowerShell:

```powershell
$env:BOOTSTRAP_LEGAL_ENTITY_NAME="Real Business Name"
$env:BOOTSTRAP_GSTIN="29XXXXXXXXXXZX"
$env:BOOTSTRAP_LEGAL_ENTITY_ADDRESS="Registered address"
$env:BOOTSTRAP_STATE_CODE="29"
$env:BOOTSTRAP_BRANCH_NAME="Main Branch"
$env:BOOTSTRAP_BRANCH_CODE="B01"
$env:BOOTSTRAP_BRANCH_ADDRESS="Branch address"
$env:BOOTSTRAP_BRANCH_STATE_CODE="29"
$env:BOOTSTRAP_OWNER_NAME="Owner Name"
$env:BOOTSTRAP_OWNER_EMAIL="owner@example.com"
$env:BOOTSTRAP_OWNER_PASSWORD="<strong temporary password>"
npm run bootstrap:owner
```

Bash:

```bash
BOOTSTRAP_LEGAL_ENTITY_NAME="Real Business Name" \
BOOTSTRAP_GSTIN="29XXXXXXXXXXZX" \
BOOTSTRAP_LEGAL_ENTITY_ADDRESS="Registered address" \
BOOTSTRAP_STATE_CODE="29" \
BOOTSTRAP_BRANCH_NAME="Main Branch" \
BOOTSTRAP_BRANCH_CODE="B01" \
BOOTSTRAP_BRANCH_ADDRESS="Branch address" \
BOOTSTRAP_BRANCH_STATE_CODE="29" \
BOOTSTRAP_OWNER_NAME="Owner Name" \
BOOTSTRAP_OWNER_EMAIL="owner@example.com" \
BOOTSTRAP_OWNER_PASSWORD="<strong temporary password>" \
npm run bootstrap:owner
```

Expected result:

```txt
Production bootstrap complete.
Legal entity: ...
Branch: ...
Owner email: ...
```

Sign in as owner and rotate the temporary password immediately if the pilot will use this environment.

## Step 5: Configure GSTIN/Address/Invoice Series

Login as owner.

Check:

- Legal entity name is correct.
- GSTIN is correct.
- Registered address is correct.
- Branch name/code/address are correct.
- State code is correct.
- Invoice series exists for the branch and financial year.
- Final invoice numbers stay within 16 characters.

Do a CA review before real GST use:

- Invoice format
- HSN/SAC mapping
- GST rates
- Rounding
- Credit note treatment
- Export format

## Step 6: Configure Pool/PS5 Resources

In Admin Resources:

- Create or confirm each Pool table.
- Create or confirm each PS5/console.
- Deactivate resources not available during the pilot.
- Confirm staff sees the correct resources on the POS board.

Recommended naming:

- `Pool 1`
- `Pool 2`
- `PS5 1`
- `PS5 2`

## Step 7: Configure Pricing and GST Rates

In Admin GST Rates:

- Confirm SAC for timed gaming/pool service.
- Confirm HSN for drinks/snacks.
- Confirm GST rates and effective dates.

In Admin Pricing/Services:

- Confirm Pool timed service.
- Confirm PS5 timed service.
- Confirm global default rate.
- Create branch override only if the pilot branch differs from the global default.
- Confirm POS effective rate for the branch.

Do one quote/check before pilot:

- Start Pool.
- Stop Pool.
- Confirm billable minutes and amount.
- Void or checkout the test bill according to rehearsal plan.

## Step 8: Create Manager and Staff Users

In Admin Users:

- Create at least one manager.
- Create Staff A.
- Create Staff B.
- Assign staff to the pilot branch.
- Use strong temporary passwords.
- Deactivate unused demo or old staff accounts.

Permissions expectation:

- Staff can open/close shifts, start/stop games, add retail lines, and checkout normal tabs.
- Manager/owner can approve sensitive actions and view reports.
- Staff should not access Admin Pricing, GST, or user management.

## Step 9: Run Test Sale

Use a visible test customer label such as `STAGING TEST SALE`.

Flow:

1. Staff opens shift.
2. Tap Pool 1.
3. Enter `STAGING TEST SALE`.
4. Start play.
5. Tap PS5 1 to add to same bill.
6. Add one snack/drink.
7. Stop both games.
8. Use bill total.
9. Set tender to UPI - PhonePe.
10. Post checkout.

Expected:

- Invoice posted.
- Pool and PS5 lines appear.
- Snack/drink line appears.
- Payment row shows UPI - PhonePe.
- Resource cards return to available.

## Step 10: Print Invoice and Receipt

From the posted checkout:

1. Open invoice.
2. Click Print invoice.
3. Open receipt view.
4. Click Print receipt.

Expected:

- GST invoice is readable.
- Receipt is readable.
- Branch printer/browser print settings are acceptable.
- No clipped totals, missing lines, or broken layout.

Capture screenshots or photos for pilot review.

## Step 11: Run Reports and CSV Exports

Login as manager or owner.

Open Reports and check:

- Sales
- Tenders
- GST / CA
- Shifts
- Exceptions
- Resource utilization
- Product sales

Export:

- GST invoice rows CSV
- GST HSN/SAC summary CSV
- Tender report CSV
- Shift summary CSV
- Product sales CSV

Expected:

- CSV downloads open in Excel/Sheets.
- Tender totals match test sale.
- GST totals are present.
- Shift summary shows the operator shift.

## Step 12: Run Backup

Compressed backup:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file=gamex-pos-staging.dump
```

Plain SQL backup:

```bash
pg_dump "$DATABASE_URL" --format=plain --no-owner --no-privileges --file=gamex-pos-staging.sql
```

Expected:

- Backup file is created.
- Backup file is stored outside the repo.
- Access to backup file is restricted.

## Step 13: Test Restore On Clean Temporary Database

Never restore into the live staging or production database.

1. Create a clean temporary database.
2. Set `RESTORE_DATABASE_URL` to the temporary database.
3. Restore compressed backup:

   ```bash
   pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges gamex-pos-staging.dump
   ```

4. Run migrations against the restored database:

   ```bash
   DATABASE_URL="$RESTORE_DATABASE_URL" npm run db:deploy
   ```

5. Start the app against the restored database in a non-production environment.
6. Confirm login, invoices, reports, and exports can be read.
7. Delete the temporary database after the drill.

Expected:

- Restore completes without errors.
- App can read restored data.
- Operator understands restore is a drill, not a live production action.

## Step 14: Final Pilot Go/No-Go Checklist

Go only if every item is yes:

| Check | Yes/No | Notes |
| --- | --- | --- |
| `npm run env:check` passes |  |  |
| `/api/health` returns OK |  |  |
| HTTPS is enabled |  |  |
| Real legal entity and branch are configured |  |  |
| GSTIN/address/invoice series reviewed |  |  |
| Pool resources are correct |  |  |
| PS5 resources are correct |  |  |
| Pricing and GST rates are reviewed |  |  |
| Owner, manager, Staff A, Staff B can login |  |  |
| Staff can open and close shifts |  |  |
| Pool + PS5 + snack checkout works |  |  |
| PhonePe tender works |  |  |
| Mixed tender works |  |  |
| Invoice prints acceptably |  |  |
| Receipt prints acceptably |  |  |
| Reports load |  |  |
| GST CSV exports |  |  |
| Tender CSV exports |  |  |
| Backup file is created |  |  |
| Restore drill passed on clean temporary DB |  |  |
| CA has reviewed GST assumptions or approved pilot test |  |  |
| Staff understand paper parallel process for day 1 |  |  |

No-go if any of these happen:

- Staff cannot complete normal sale.
- Checkout, invoice, shift, or report totals are clearly wrong.
- Printer output is unusable.
- Branch/tenant data appears under the wrong account.
- Backup or restore drill fails.
- Production-like env vars are weak or missing.
- CA blocks GST invoice use.

# Production Readiness

GameX POS is ready for a controlled one-branch pilot when this checklist is complete.

## Ready

- POS-first workflow for operator shifts, running tabs, timed services, retail lines, checkout, GST invoice posting, refunds/credit notes, reports, and exports.
- Secure HttpOnly cookie sessions with Argon2id password hashing.
- Legal-entity tenant boundary in tenant-sensitive data.
- Server-confirmed timestamps for billing-relevant actions.
- Immutable posted GST invoice snapshots.
- Hidden double-entry journal posting behind POS flows.
- Online-first PWA shell with offline draft-only behavior.
- Dockerized production build.
- Environment validation and health endpoint.
- Backup and restore procedure.
- CI for lint, typecheck, unit tests, and build.

## Manual CA and Legal Review

Confirm these before real GST use:

- GST invoice format and wording.
- GST rate and HSN/SAC classification for each product and service.
- Invoice series policy and branch/entity numbering.
- Rounding behavior.
- Credit-note/refund treatment.
- E-invoice or e-way bill applicability, if any.
- GST export fields needed by the CA.

## Intentionally Not Included

- Full accounting UI.
- Bank reconciliation.
- Payment gateway confirmation.
- Automated GST filing.
- Formal cash drawer management.
- Multi-country tax support.
- Full offline financial posting.

## Deployment Checklist

For a step-by-step staging/production-like rehearsal, use [Staging Pilot Runbook](staging-pilot-runbook.md).

1. Provision PostgreSQL.
2. Configure backup storage.
3. Set production env vars.
4. Build and deploy the Docker image.
5. Run `npm run env:check`.
6. Run `npx prisma migrate deploy`.
7. Run `npm run bootstrap:owner` once.
8. Start the web service.
9. Confirm `/api/health` returns OK.
10. Confirm HTTPS.
11. Confirm owner login.
12. Configure branch, resources, products, pricing, GST rates, invoice series, and users.
13. Run a full test sale and refund.
14. Close a shift and verify reports.

## Rollback Plan

- Keep the previous Docker image tag available.
- Before deployment, take a database backup.
- If deployment fails before migrations, redeploy the previous image.
- If deployment fails after migrations, stop and inspect the migration state before rolling back code.
- Do not manually edit posted invoices, journal entries, or audit logs.

## Backup Plan

- Daily automated PostgreSQL backup.
- Backup stored outside the application server.
- Restore drill before pilot day 1.
- Restore drill after changing database hosting or backup tooling.

## Pilot Plan

- Start with one branch.
- Run parallel with paper on day 1.
- Reconcile daily for the first 3 days.
- Fix only critical workflow issues during the pilot.
- Review one-week totals before next-branch rollout.

## Known Limitations

- This is not a full accounting product.
- GST exports are CA-friendly summaries, not official filing automation.
- Payment methods are manually recorded, not gateway-confirmed.
- Offline mode intentionally blocks final financial posting.
- CA should review GST invoice format, rounding, and compliance before real GST use.

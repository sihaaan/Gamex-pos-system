# RC Pilot 1 Notes

Date: 2026-06-11

Base commit before rehearsal slice: `9548443 Harden deployment readiness`

Final release candidate tag: `rc-pilot-1`

## Included

- Staff POS workflow for Pool, PS5, retail snacks/drinks, running bills, pause/resume, stop, checkout, mixed tenders, invoices, receipts, and shift close.
- Admin setup for legal entities, branches, users, resources, products, services/pricing, discount rules, and GST rates.
- GST invoice posting with immutable invoice and line snapshots.
- Refund/credit-note path with reversing journal entries.
- Reports and CA-friendly exports for sales, tenders, GST, shifts, exceptions, resource utilization, and product sales.
- Deployment readiness hardening: env validation, health endpoint, Docker entrypoint validation, production compose example, bootstrap owner script, CI, backup docs, security checklist, and pilot checklist.
- Release candidate rehearsal documentation and Playwright fake-day coverage.

## Tested

Automated:

- Staff opens shift.
- Pool-only sale with PhonePe.
- Pool plus PS5 plus chips sale.
- Mixed Cash plus PhonePe tender.
- Invoice view.
- Receipt view.
- PS5 pause/resume sale.
- Snacks-only sale.
- Shift close.
- Manager reports page.
- Tender CSV response and headers.
- GST CSV response and headers.
- Checkout blocked while games are running.
- Selected bill clears after checkout.
- Shift close blocked while open bills exist.

Manual rehearsal to run before pilot:

- Manager-approved discount above staff limit.
- Refund/credit note from posted invoice.
- Stock adjustment with reason.
- Printer/browser print on the actual branch device.
- Backup file creation.
- Restore into a clean temporary database.
- Staff A to Staff B shift handoff.

## Verification Commands

Run before tagging or deploying:

```bash
npm run env:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e -- --project=chromium
```

Status for this RC rehearsal pass:

- `npm run env:check`: passed
- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run test`: passed, 22 files and 86 tests
- `npm run build`: passed
- `npm run test:e2e -- --project=chromium`: passed, 5 tests including the RC fake-day rehearsal

## Known Limitations

- Payment methods are manually recorded, not gateway-confirmed.
- GST exports are CA-friendly summaries, not official filing automation.
- Offline mode blocks final financial posting.
- This is not a full accounting product.
- CA should review GST invoice format, rounding, and exports before real GST use.
- MFA fields exist, but owner/manager MFA enrollment is deferred.
- Production restore must be rehearsed against a separate clean database before go-live.

## Deferred Features

- Full accounting UI.
- Bank reconciliation.
- Payment gateway integration and automatic UPI confirmation.
- Advanced inventory purchasing and supplier management.
- Full offline billing.
- Formal cash drawer management.
- Multi-branch rollout automation.

## CA Review Required

- GST invoice format and statutory wording.
- HSN/SAC codes and GST rates for services, snacks, and drinks.
- Invoice series format and branch/entity policy.
- Rounding behavior.
- Credit note/refund treatment.
- E-invoice applicability, if any.
- GST/CA export columns and format.

## Pilot Go/No-Go Checklist

Go only if:

- Production env validation passes.
- `/api/health` returns OK.
- Real legal entity, branch, GSTIN, invoice series, services, products, and GST rates are configured.
- Owner, manager, Staff A, and Staff B accounts are active and scoped correctly.
- Staff can complete Pool, PS5, mixed tender, and snacks-only sales.
- Checkout is blocked while games are running.
- Invoice and receipt print acceptably on the branch device.
- Manager can approve high discount and create refund/credit note.
- Stock adjustment creates an auditable movement.
- Shift close works with no open-tab warning after all bills are posted.
- Reports and CSV exports load.
- Daily backup is configured.
- Restore procedure has been tested on a clean temporary database.
- CA has reviewed GST assumptions or explicitly approved pilot use pending final review.

No-go if:

- Any staff cannot post a normal sale.
- Totals are wrong in checkout, invoice, shift, or reports.
- Tenant or branch data leaks across accounts.
- Posted invoices can be mutated instead of corrected through credit notes.
- Backup or restore path is not understood by the operator.
- HTTPS or production secrets are not configured for real deployment.

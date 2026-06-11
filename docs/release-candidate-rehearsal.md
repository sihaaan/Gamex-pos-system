# Release Candidate Pilot Rehearsal

Use this checklist before a one-branch pilot. The goal is to rehearse a realistic business day and catch release-blocking issues only.

## Scope

- One legal entity.
- One branch.
- Owner, manager, and two staff users.
- Pool tables, PS5 consoles, snacks/drinks, GST invoices, shift close, reports, exports, backup, and restore documentation.
- No live payment gateway; tenders are manually recorded.

## Local Rehearsal Users

Seeded local/demo users:

- Owner: `ag-owner@gamex.local`
- Manager: `ag-manager@gamex.local`
- Staff A: `ag-staff@gamex.local`
- Password: `Gamex@12345`

For a fuller staff handoff rehearsal, sign in as owner and create Staff B in Admin Users:

- Staff B: `ag-staff-b@gamex.local`
- Role: `STAFF`
- Branch: the pilot branch
- Password: use a temporary password and rotate it after first login

Do not use seeded demo users or passwords in production.

## Setup Checklist

1. Create or check the legal entity:
   - Legal name
   - GSTIN
   - Registered address
   - State code
2. Create or check one real branch:
   - Branch name
   - Branch code
   - Branch address
   - State code
3. Create users:
   - Owner
   - Manager
   - Staff A
   - Staff B
4. Configure Pool resources:
   - Pool 1
   - Pool 2
   - Any additional active tables
5. Configure PS5 resources:
   - PS5 1
   - PS5 2
   - Any additional active consoles
6. Configure timed pricing:
   - Pool timed service
   - PS5 timed service
   - Branch override if this branch differs from global default
7. Configure snacks/drinks:
   - Chips pack
   - Cold drink
   - Any real pilot SKUs
8. Configure GST:
   - HSN/SAC codes
   - GST rates
   - Effective dates
9. Configure invoice series:
   - Legal entity
   - Branch
   - Financial year
   - Prefix within 16-character final invoice number limit
10. Confirm health check:
    ```bash
    curl http://localhost:3000/api/health
    ```
11. Confirm backup command:
    ```bash
    pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file=gamex-pos-rehearsal.dump
    ```
12. Confirm restore procedure is documented in [Backup and Restore](backup-restore.md).

## Fake Business Day

### Staff A Shift

1. Staff A signs in.
2. Staff A opens an operator shift.
3. Customer 1:
   - Start Pool 1.
   - Stop Pool 1.
   - Pay full amount with UPI - PhonePe.
   - Post checkout.
   - Expected: GST invoice is posted and Pool 1 returns to available.
4. Customer 2:
   - Start Pool 1.
   - Add PS5 1 to the same bill.
   - Add Chips pack.
   - Stop Pool 1.
   - Stop PS5 1.
   - Record mixed tender: Cash plus UPI - PhonePe.
   - Post checkout.
   - Expected: invoice has Pool, PS5, chips, Cash payment row, and PhonePe payment row.
5. Customer 3:
   - Start PS5 1.
   - Pause PS5 1.
   - Resume PS5 1.
   - Stop PS5 1.
   - Apply discount with reason.
   - If discount exceeds staff limit, manager approves it.
   - Pay with UPI - PhonePe.
   - Post checkout.
   - Expected: discount reason appears in checkout flow and invoice total is reduced.
6. Customer 4:
   - Create a snacks-only bill.
   - Add one snack/drink.
   - Pay with UPI - PhonePe.
   - Post checkout.
   - Expected: retail-only invoice posts without a timed game.
7. Refund/credit note:
   - Manager creates a full or partial refund for one posted invoice.
   - Expected: original invoice is not mutated; credit note, refund payment, reversing journal, and audit log are created.
8. Stock adjustment:
   - Manager adjusts one product stock quantity with a reason.
   - Expected: stock movement and audit log are created.
9. Staff A closes shift.
10. Expected shift close:
    - Gross sales visible
    - Discounts visible
    - Refunds visible
    - Voids visible if any
    - Net sales visible
    - GST collected visible
    - Cash total visible
    - PhonePe total visible
    - Mixed tender total visible
    - No active/unclosed tabs warning

### Staff B Shift

1. Staff B signs in.
2. Staff B opens an operator shift.
3. Customer 5:
   - Start PS5 1.
   - Stop PS5 1.
   - Pay with UPI - Google Pay or PhonePe.
   - Post checkout.
4. Staff B closes shift.
5. Expected: Staff B shift summary is separate from Staff A shift summary.

## Owner/Manager Report Review

Owner or manager checks:

- Sales
- Tenders
- GST / CA export
- Shifts
- Exceptions
- Resource utilization
- Product sales

Export and confirm CSV responses/downloads:

- GST invoice rows CSV
- GST HSN/SAC summary CSV
- Tender CSV
- Shift summary CSV
- Product sales CSV

Print checks:

- Open one GST invoice and use Print invoice.
- Open receipt view and use Print receipt.

Backup check:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file=gamex-pos-rehearsal.dump
```

Restore documentation check:

- Open [Backup and Restore](backup-restore.md).
- Confirm restore command is clear.
- Confirm the team understands that restore drills must use a clean temporary database, never the live production database.

## Manual Pilot Smoke Script

### Click Sequence

1. Login as Staff A: `ag-staff@gamex.local`.
2. Open shift.
3. Tap Pool 1.
4. Enter customer name `RC Customer 1`.
5. Start play.
6. Stop Pool 1.
7. Use bill total.
8. Post checkout.
9. Open invoice.
10. Open receipt view.
11. Return to POS.
12. Tap Pool 1.
13. Enter customer name `RC Customer 2`.
14. Start play.
15. Tap PS5 1 to add it to the same bill.
16. Add Chips pack.
17. Stop Pool 1 and PS5 1.
18. Set Tender 1 to Cash with part amount.
19. Add payment.
20. Set Tender 2 to UPI - PhonePe and Fill rest.
21. Post checkout.
22. Start PS5 1 for `RC Customer 3`.
23. Pause, resume, and stop.
24. Add discount reason; get manager approval if the UI requires it.
25. Post checkout.
26. Create snacks-only bill `RC Customer 4`.
27. Add snack/drink.
28. Post checkout.
29. Close Staff A shift.
30. Login as Staff B and repeat one PS5 sale.
31. Close Staff B shift.
32. Login as manager or owner.
33. Open Reports and review every tab.
34. Export GST CSV and tender CSV.

### Expected Outcomes

- No checkout is possible while a game is running or paused.
- Every customer bill has the correct game and retail lines.
- Mixed tender invoice shows both tender rows.
- Invoice and receipt render without broken layout.
- Shift close has no active tab warning after all bills are posted.
- Reports show the posted invoices from the fake day.
- GST and tender CSV responses download as CSV.
- Backup command produces a file.

### Screenshots To Capture

- POS resource grid with an active Pool/PS5 session.
- Current bill before checkout.
- Mixed tender payment section before posting.
- GST invoice view.
- Receipt view.
- Staff A shift summary.
- Staff B shift summary.
- Reports Sales tab.
- Reports Tenders tab.
- Reports GST / CA tab.
- Exported CSV file opened locally.
- Terminal output for `/api/health`.
- Terminal output showing backup file creation.

### Totals To Compare

- Paper/manual total vs POS net sales.
- Cash total vs cash actually collected.
- PhonePe total vs PhonePe app history.
- Google Pay total vs Google Pay app history.
- GST collected vs GST report.
- Product quantity sold vs product stock movement.
- Shift A total vs Shift B total.

## Release-Blocking Issues

Fix only issues that block pilot operation:

- Staff cannot complete sale.
- Checkout total, invoice total, or tender total is clearly wrong.
- Invoice or receipt cannot be opened or printed.
- Reports or exports fail to load.
- Branch/legal-entity scoping leaks data.
- Users cannot be created, reset, deactivated, or branch-scoped.
- Backup command or restore documentation is unusable.
- Production env check or health check is broken.
- CI is broken.

Do not block RC for minor wording, visual polish, or future accounting features unless staff safety or billing accuracy is affected.

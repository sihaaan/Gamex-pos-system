# Security Checklist

Use this before a real pilot and again before each new branch rollout.

## Transport and Hosting

- HTTPS is required in production.
- `NODE_ENV` is `production`.
- `SESSION_SECRET` is strong, random, and stored only in the deployment secret manager.
- Cookies are HttpOnly and secure in production.
- Database is not publicly reachable.
- Production env vars are not committed to Git.

## Accounts

- No demo users exist in production.
- No demo password such as `Gamex@12345` is used in production.
- Owner and manager accounts are reviewed before go-live.
- Staff accounts are branch-scoped where appropriate.
- Old staff accounts are deactivated immediately.
- Password reset is handled by an owner/manager through the admin flow.
- MFA-ready owner/manager fields exist; enable MFA when the flow is added.

## POS Controls

- Staff cannot checkout without an active operator shift.
- Sensitive actions require manager/owner permission.
- Audit logs are reviewed for voids, refunds, discounts, price overrides, stock adjustments, and shift reopen actions.
- Branch and legal-entity scoping are tested after user setup.
- Offline mode is understood: final financial posting requires server confirmation.

## Data and Backups

- Daily PostgreSQL backups are configured.
- Backup files are encrypted or stored in a restricted location.
- Restore has been tested before pilot day 1.
- Backup access is limited to owners/operators who need it.
- Production database credentials are rotated if shared or exposed.

## Devices

- POS devices use OS login or screen lock.
- Browser password saving is disabled on shared staff devices.
- Staff log out at shift end.
- Lost or replaced devices trigger session review and password rotation if needed.

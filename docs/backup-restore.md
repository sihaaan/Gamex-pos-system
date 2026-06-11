# Backup and Restore

Backups are a production requirement. Untested backups are not real backups.

## Recommended Policy

- Run an automated PostgreSQL backup at least once per day.
- Store backups outside the application server.
- Restrict access to backup files because they contain customer, invoice, payment, and audit data.
- Keep at least 7 daily backups and 4 weekly backups for the pilot.
- Test restore before pilot day 1 and after any infrastructure change.

## Plain SQL Backup

```bash
pg_dump "$DATABASE_URL" --format=plain --no-owner --no-privileges --file=gamex-pos-backup.sql
```

## Compressed Backup

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file=gamex-pos-backup.dump
```

## Restore Plain SQL

Restore into a clean database:

```bash
psql "$RESTORE_DATABASE_URL" --file=gamex-pos-backup.sql
```

## Restore Compressed Backup

Restore into a clean database:

```bash
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges gamex-pos-backup.dump
```

## Test Restore Drill

1. Create a temporary restore database.
2. Restore the latest backup into it.
3. Run `npx prisma migrate deploy` against the restored database.
4. Start the app with the restored database URL in a non-production environment.
5. Confirm login, shifts, tabs, invoices, reports, and exports can be read.
6. Delete the temporary restore database after the drill.

Never run a restore drill against the live production database.

## Docker Compose Local Example

```bash
docker compose exec postgres pg_dump -U gamex -d gamex_pos --format=custom --no-owner --no-privileges --file=/tmp/gamex-pos.dump
docker compose cp postgres:/tmp/gamex-pos.dump ./gamex-pos.dump
```

## Storage

Use encrypted cloud storage or a restricted backup location. Do not store production backups in the Git repository, shared desktop folders, or public drives.

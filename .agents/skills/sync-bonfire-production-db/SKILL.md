---
name: sync-bonfire-production-db
description: Safely refresh the Sob a Luz do Bonfire local SQL.js database from the Railway production PostgreSQL database. Use when reproducing production behavior locally, updating server/data/local.sqlite, backing up the existing local snapshot, running db:sync:prod, or validating copied production row counts and database integrity.
---

# Sync Bonfire Production DB

Run the bundled safe wrapper from the repository root:

```bash
bash .agents/skills/sync-bonfire-production-db/scripts/sync-production-db.sh
```

The wrapper:

1. Resolves a local Node 22 runtime.
2. Verifies `server/.env` contains `PRODUCTION_DATABASE_URI` without printing it.
3. Creates a timestamped backup of the existing local SQLite file.
4. Runs the repository's `pnpm run db:sync:prod` command.
5. Restores the backup automatically if synchronization or validation fails.
6. Validates SQL.js integrity and prints non-sensitive table counts.

Never print, copy, or commit production credentials. Never write to production; the source connection is read-only by workflow. Keep timestamped backups until the user explicitly removes them.

After syncing, use `DATABASE_TYPE=sqljs` and `DATABASE_SQLITE_PATH=data/local.sqlite` in `server/.env` to run locally.

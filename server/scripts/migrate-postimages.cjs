#!/usr/bin/env node
// Build the server first. This script never bootstraps the app or its migrations.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

async function migratePostimages({
  db,
  images,
  apply,
  save,
  progress = () => {},
}) {
  await db.query('BEGIN READ ONLY');
  let rows;
  try {
    ({ rows } = await db.query(
      'SELECT id, title, cover FROM games WHERE cover ~ $1 ORDER BY id',
      ['^https://i\\.postimg\\.cc/'],
    ));
  } finally {
    await db.query('ROLLBACK');
  }
  const report = {
    startedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    status: 'inventoried',
    records: rows.map((row) => ({
      ...row,
      originalUrl: row.cover,
      newUrl: null,
    })),
    sources: [],
  };
  save(report);
  if (!apply) return report;

  const imported = new Map();
  for (const sourceUrl of new Set(rows.map((row) => row.cover))) {
    const source = { sourceUrl };
    try {
      const image = await images.importRemote(sourceUrl, 'banners');
      imported.set(sourceUrl, image);
      Object.assign(source, { status: 'verified', ...image });
    } catch (error) {
      Object.assign(source, { status: 'failed', error: error.message });
    }
    report.sources.push(source);
    progress(source);
    save(report);
  }
  for (const record of report.records) {
    record.newUrl = imported.get(record.originalUrl)?.url ?? null;
  }
  const changes = report.records.filter((record) => record.newUrl);
  report.status = 'copies-verified';
  save(report); // Durable rollback mapping exists before any database write.

  if (changes.length) {
    await db.query('BEGIN');
    try {
      for (const record of changes) {
        const current = await db.query(
          'SELECT cover FROM games WHERE id = $1 FOR UPDATE',
          [record.id],
        );
        if (
          current.rows.length !== 1 ||
          current.rows[0].cover !== record.originalUrl
        ) {
          throw new Error(
            `Game ${record.id} changed since the inventory; no database links were updated.`,
          );
        }
      }
      for (const record of changes) {
        const update = await db.query(
          'UPDATE games SET cover = $1 WHERE id = $2 AND cover = $3',
          [record.newUrl, record.id, record.originalUrl],
        );
        if (update.rowCount !== 1)
          throw new Error(`Game ${record.id} did not update exactly once.`);
      }
      await db.query(
        'INSERT INTO admin_audit_logs (action, actor, payload, result) VALUES ($1, $2, $3::json, $4::json)',
        [
          'media.migrate-postimages',
          'r2-migration',
          JSON.stringify({
            changes: changes.map(({ id, originalUrl, newUrl }) => ({
              id,
              originalUrl,
              newUrl,
            })),
          }),
          JSON.stringify({ updated: changes.length }),
        ],
      );
    } catch (error) {
      await db.query('ROLLBACK');
      report.status = 'database-update-failed';
      report.error = error.message;
      save(report);
      throw error;
    }
    report.status = 'committing';
    save(report);
    try {
      await db.query('COMMIT');
    } catch (error) {
      report.status = 'commit-outcome-unknown';
      report.error =
        'Check every mapped database URL before retrying: ' + error.message;
      save(report);
      throw error;
    }
    // Do not describe an ambiguous commit or failed readback as a rollback.
    report.status = 'committed';
    save(report);
    for (const record of changes) {
      const readback = await db.query('SELECT cover FROM games WHERE id = $1', [
        record.id,
      ]);
      if (readback.rows[0]?.cover !== record.newUrl) {
        throw new Error(
          `Post-commit verification failed for game ${record.id}; inspect the manifest before retrying.`,
        );
      }
    }
  }
  report.updated = changes.length;
  report.remaining = rows.length - changes.length;
  report.status = report.remaining ? 'incomplete' : 'complete';
  report.finishedAt = new Date().toISOString();
  save(report);
  return report;
}

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: 'boolean', default: false },
      manifest: { type: 'string' },
    },
  });
  if (!values.manifest)
    throw new Error(
      'Supply --manifest /absolute/path/to/new-report.json; add --apply to upload and update verified covers.',
    );
  if (!process.env.DATABASE_URI) throw new Error('DATABASE_URI is required.');
  const manifestPath = path.resolve(values.manifest);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.closeSync(fs.openSync(manifestPath, 'wx', 0o600));
  const save = (report) => {
    fs.writeFileSync(
      manifestPath + '.tmp',
      JSON.stringify(report, null, 2) + '\n',
      { mode: 0o600 },
    );
    fs.renameSync(manifestPath + '.tmp', manifestPath);
  };
  const { Client } = require('pg');
  const { ConfigService } = require('@nestjs/config');
  const {
    MediaStorageService,
  } = require('../dist/media/media-storage.service');
  const { ImageImportService } = require('../dist/media/image-import.service');
  const storage = new MediaStorageService(new ConfigService());
  if (values.apply && !storage.isConfigured())
    throw new Error('R2 must be configured before applying a migration.');
  const db = new Client({
    connectionString: process.env.DATABASE_URI,
    application_name: 'bonfire-r2-migration',
    connectionTimeoutMillis: 10000,
    options: '-c statement_timeout=15000 -c lock_timeout=5000',
  });
  await db.connect();
  try {
    const report = await migratePostimages({
      db,
      images: new ImageImportService(storage),
      apply: values.apply,
      save,
      progress: ({ sourceUrl, status, error }) =>
        console.log(JSON.stringify({ sourceUrl, status, error })),
    });
    console.log(
      JSON.stringify({
        status: report.status,
        candidates: report.records.length,
        updated: report.updated ?? 0,
        remaining: report.remaining,
        manifestPath,
      }),
    );
    if (report.status === 'incomplete') process.exitCode = 2;
  } finally {
    await db.end();
  }
}

module.exports = { migratePostimages };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

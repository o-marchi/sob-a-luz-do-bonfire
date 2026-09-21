const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migratePostimages } = require('./migrate-postimages.cjs');

function database(rows, current = rows) {
  const calls = [];
  let committed = false;
  return {
    calls,
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT id')) return { rows };
      if (sql.startsWith('SELECT cover'))
        return {
          rows: current
            .filter((r) => r.id === args[0])
            .map((r) => ({
              cover: committed ? 'https://media.example/image.png' : r.cover,
            })),
        };
      if (sql === 'COMMIT') committed = true;
      return { rows: [], rowCount: 1 };
    },
  };
}

test('dry run never imports or writes links', async () => {
  const db = database([{ id: 1, cover: 'https://i.postimg.cc/a/image.png' }]);
  const report = await migratePostimages({
    db,
    images: {
      importRemote() {
        throw Error('must not import');
      },
    },
    apply: false,
    save() {},
  });
  assert.equal(report.records.length, 1);
  assert.equal(
    db.calls.some(({ sql }) => sql.startsWith('UPDATE')),
    false,
  );
});

test('copies a shared URL once and saves rollback values before updating both records', async () => {
  const cover = 'https://i.postimg.cc/a/image.png';
  const db = database([
    { id: 1, cover },
    { id: 2, cover },
  ]);
  let imports = 0;
  const snapshots = [];
  const report = await migratePostimages({
    db,
    images: {
      async importRemote() {
        imports++;
        return { url: 'https://media.example/image.png' };
      },
    },
    apply: true,
    save(r) {
      snapshots.push({
        report: JSON.parse(JSON.stringify(r)),
        writes: db.calls.filter(({ sql }) => sql.startsWith('UPDATE')).length,
      });
    },
  });
  assert.equal(imports, 1);
  assert.equal(report.updated, 2);
  assert.equal(report.remaining, 0);
  assert.ok(
    snapshots.some(
      ({ report: r, writes }) =>
        writes === 0 &&
        r.status === 'copies-verified' &&
        r.records.every((row) => row.newUrl && row.originalUrl === cover),
    ),
  );
  assert.equal(
    db.calls.filter(({ sql }) => sql.startsWith('INSERT INTO admin_audit_logs'))
      .length,
    1,
  );
});

test('source failure retains existing links without starting a write transaction', async () => {
  const db = database([{ id: 1, cover: 'https://i.postimg.cc/a/image.png' }]);
  const report = await migratePostimages({
    db,
    images: {
      async importRemote() {
        throw Error('HTTP 503');
      },
    },
    apply: true,
    save() {},
  });
  assert.equal(report.updated, 0);
  assert.equal(report.remaining, 1);
  assert.equal(report.status, 'incomplete');
  assert.equal(
    db.calls.some(({ sql }) => sql === 'BEGIN'),
    false,
  );
});

test('a concurrent cover edit aborts the transaction before any record changes', async () => {
  const db = database(
    [{ id: 1, cover: 'https://i.postimg.cc/a/image.png' }],
    [{ id: 1, cover: 'https://other.example/edited.png' }],
  );
  await assert.rejects(
    migratePostimages({
      db,
      images: {
        async importRemote() {
          return { url: 'https://media.example/image.png' };
        },
      },
      apply: true,
      save() {},
    }),
    /changed since the inventory/,
  );
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
  assert.equal(
    db.calls.some(({ sql }) => sql.startsWith('UPDATE')),
    false,
  );
});

test('a partial source failure updates only the verified record', async () => {
  const db = database([
    { id: 1, cover: 'https://i.postimg.cc/good/image.png' },
    { id: 2, cover: 'https://i.postimg.cc/busy/image.png' },
  ]);
  const report = await migratePostimages({
    db,
    images: {
      async importRemote(source) {
        if (source.includes('/busy/')) throw Error('HTTP 503');
        return { url: 'https://media.example/image.png' };
      },
    },
    apply: true,
    save() {},
  });
  assert.equal(report.updated, 1);
  assert.equal(report.remaining, 1);
  assert.equal(report.status, 'incomplete');
  assert.deepEqual(
    db.calls
      .filter(({ sql }) => sql.startsWith('UPDATE'))
      .map(({ args }) => args[1]),
    [1],
  );
});

test('an uncertain commit preserves its mapping and does not claim rollback', async () => {
  const db = database([{ id: 1, cover: 'https://i.postimg.cc/a/image.png' }]);
  const query = db.query.bind(db);
  db.query = (sql, args) => {
    if (sql === 'COMMIT') throw Error('Connection lost');
    return query(sql, args);
  };
  let lastReport;
  await assert.rejects(
    migratePostimages({
      db,
      images: {
        async importRemote() {
          return { url: 'https://media.example/image.png' };
        },
      },
      apply: true,
      save(report) {
        lastReport = JSON.parse(JSON.stringify(report));
      },
    }),
    /Connection lost/,
  );
  assert.equal(lastReport.status, 'commit-outcome-unknown');
  assert.ok(lastReport.records[0].newUrl);
  assert.equal(db.calls.filter(({ sql }) => sql === 'ROLLBACK').length, 1); // inventory only
});

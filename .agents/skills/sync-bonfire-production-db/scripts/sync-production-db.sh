#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

find_node_22() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -p 'process.versions.node.split(`.`)[0]')" == "22" ]]; then
    command -v node
    return
  fi

  local candidate
  for candidate in "$HOME"/.nvm/versions/node/v22*/bin/node; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
    fi
  done | sort -V | tail -n 1
}

node_bin="$(find_node_22)"
if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
  echo "Node 22 is required. Install it or activate it with nvm." >&2
  exit 1
fi

node_dir="$(dirname "$node_bin")"
export PATH="$node_dir:$PATH"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required." >&2
  exit 1
fi

if [[ ! -f server/.env ]]; then
  echo "Missing server/.env." >&2
  exit 1
fi

database_path="$($node_bin - <<'NODE'
const path = require('node:path');
const dotenv = require('./server/node_modules/dotenv');
dotenv.config({ path: 'server/.env' });

if (!process.env.PRODUCTION_DATABASE_URI) {
  process.stderr.write('Missing PRODUCTION_DATABASE_URI in server/.env.\n');
  process.exit(1);
}

const configured = process.env.DATABASE_SQLITE_PATH || 'data/local.sqlite';
process.stdout.write(path.resolve('server', configured));
NODE
)"

mkdir -p "$(dirname "$database_path")"
backup_path=""

if [[ -f "$database_path" ]]; then
  backup_path="${database_path}.backup-$(date +%Y%m%d-%H%M%S)"
  cp --preserve=mode,timestamps "$database_path" "$backup_path"
  echo "Backed up local database to $backup_path"
fi

restore_on_error() {
  local status=$?
  if [[ -n "$backup_path" && -f "$backup_path" ]]; then
    cp --preserve=mode,timestamps "$backup_path" "$database_path"
    echo "Sync failed; restored $database_path from $backup_path" >&2
  fi
  exit "$status"
}
trap restore_on_error ERR

pnpm run db:sync:prod

DATABASE_PATH="$database_path" "$node_bin" - <<'NODE'
const fs = require('node:fs');
const initSqlJs = require('./server/node_modules/sql.js');

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(process.env.DATABASE_PATH));
  const integrity = db.exec('PRAGMA integrity_check')[0]?.values[0]?.[0];

  if (integrity !== 'ok') {
    throw new Error(`SQLite integrity check failed: ${integrity ?? 'no result'}`);
  }

  const tables = [
    'games',
    'user',
    'players',
    'pools',
    'pool_options',
    'campaigns',
    'campaign_players',
    'pool_option_players',
  ];

  console.log('SQLite integrity: ok');
  for (const table of tables) {
    const exists = db.exec(
      `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '${table}'`,
    )[0]?.values[0]?.[0];
    if (!exists) continue;

    const count = db.exec(`SELECT COUNT(*) FROM "${table}"`)[0].values[0][0];
    console.log(`${table}: ${count}`);
  }

  db.close();
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
NODE

trap - ERR
echo "Local production snapshot ready at $database_path"
if [[ -n "$backup_path" ]]; then
  echo "Backup retained at $backup_path"
fi

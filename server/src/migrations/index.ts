import * as migration_20250727_110407 from './20250727_110407';

export const migrations = [
  {
    up: migration_20250727_110407.up,
    down: migration_20250727_110407.down,
    name: '20250727_110407'
  },
];

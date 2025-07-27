import * as migration_20250727_072805 from './20250727_072805';

export const migrations = [
  {
    up: migration_20250727_072805.up,
    down: migration_20250727_072805.down,
    name: '20250727_072805'
  },
];

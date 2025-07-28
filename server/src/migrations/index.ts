import * as migration_20250728_210706 from './20250728_210706';

export const migrations = [
  {
    up: migration_20250728_210706.up,
    down: migration_20250728_210706.down,
    name: '20250728_210706'
  },
];

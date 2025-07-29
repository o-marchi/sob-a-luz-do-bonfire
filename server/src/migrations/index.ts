import * as migration_20250728_210706 from './20250728_210706';
import * as migration_20250728_212505 from './20250728_212505';
import * as migration_20250729_002644 from './20250729_002644';

export const migrations = [
  {
    up: migration_20250728_210706.up,
    down: migration_20250728_210706.down,
    name: '20250728_210706',
  },
  {
    up: migration_20250728_212505.up,
    down: migration_20250728_212505.down,
    name: '20250728_212505',
  },
  {
    up: migration_20250729_002644.up,
    down: migration_20250729_002644.down,
    name: '20250729_002644'
  },
];

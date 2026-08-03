import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DataSource, type FindManyOptions } from 'typeorm';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import {
  DEFAULT_RULES_MARKDOWN,
  RULES_CONTENT_KEY,
} from '../content/default-rules';
import { SiteContent } from '../content/entities/site-content.entity';
import { Game } from '../games/entities/game.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { User } from '../users/entities/user.entity';

dotenv.config();

const entities = [
  Game,
  User,
  Player,
  Pool,
  PoolOption,
  Campaign,
  CampaignPlayer,
  SiteContent,
];

function getSqlitePath(): string {
  return resolve(
    process.cwd(),
    process.env.DATABASE_SQLITE_PATH || 'data/local.sqlite',
  );
}

function createSourceDataSource(): DataSource {
  const productionDatabaseUri = process.env.PRODUCTION_DATABASE_URI;

  if (!productionDatabaseUri) {
    throw new Error('Missing PRODUCTION_DATABASE_URI in server/.env');
  }

  return new DataSource({
    type: 'postgres',
    url: productionDatabaseUri,
    ssl:
      process.env.PRODUCTION_DATABASE_SSL === 'false'
        ? false
        : { rejectUnauthorized: false },
    entities,
    synchronize: false,
  });
}

function createTargetDataSource(sqlitePath: string): DataSource {
  return new DataSource({
    type: 'sqljs',
    location: sqlitePath,
    autoSave: true,
    entities,
    synchronize: true,
    dropSchema: true,
  });
}

async function copyRepository<T extends object>(
  label: string,
  source: DataSource,
  target: DataSource,
  entity: new () => T,
  options: FindManyOptions<T> = {},
): Promise<void> {
  const rows = await source.getRepository(entity).find(options);
  await target.getRepository(entity).save(rows, { chunk: 100 });
  console.log(`Copied ${rows.length} ${label}`);
}

async function hasTable(
  source: DataSource,
  tableName: string,
): Promise<boolean> {
  const queryRunner = source.createQueryRunner();

  try {
    return await queryRunner.hasTable(tableName);
  } finally {
    await queryRunner.release();
  }
}

async function syncProductionToSqlite(): Promise<void> {
  const sqlitePath = getSqlitePath();
  mkdirSync(dirname(sqlitePath), { recursive: true });
  rmSync(sqlitePath, { force: true });

  const source = createSourceDataSource();
  const target = createTargetDataSource(sqlitePath);

  try {
    await source.initialize();
    await target.initialize();

    await copyRepository('games', source, target, Game);

    const users = await source
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.password')
      .getMany();
    await target.getRepository(User).save(users, { chunk: 100 });
    console.log(`Copied ${users.length} users`);

    await copyRepository('players', source, target, Player);
    await copyRepository('pools', source, target, Pool, {
      loadEagerRelations: false,
    });
    await copyRepository('pool options', source, target, PoolOption, {
      relations: { pool: true, game: true, players: true },
    });
    await copyRepository('campaigns', source, target, Campaign, {
      relations: { game: true, pool: true },
      loadEagerRelations: false,
    });
    await copyRepository('campaign players', source, target, CampaignPlayer, {
      relations: { campaign: true, player: true },
    });

    if (await hasTable(source, 'site_content')) {
      await copyRepository('site content entries', source, target, SiteContent);
    } else {
      await target.getRepository(SiteContent).save({
        key: RULES_CONTENT_KEY,
        content: DEFAULT_RULES_MARKDOWN,
      });
      console.log('Production has no site content table; seeded default rules');
    }

    console.log(`SQLite database created at ${sqlitePath}`);
  } finally {
    if (target.isInitialized) {
      await target.destroy();
    }

    if (source.isInitialized) {
      await source.destroy();
    }
  }
}

void syncProductionToSqlite().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

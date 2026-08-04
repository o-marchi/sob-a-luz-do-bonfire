import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import { AdminAutomation1763760000000 } from './migrations/1763760000000-AdminAutomation';
import { SiteContent1785729600000 } from './migrations/1785729600000-SiteContent';
import { CurrentGameDetails1785736800000 } from './migrations/1785736800000-CurrentGameDetails';
import { GameRecommendations1785795104186 } from './migrations/1785795104186-GameRecommendations';
import { GameRecommendationRegistry1785796200000 } from './migrations/1785796200000-GameRecommendationRegistry';
import { GameResearchCache1785797300000 } from './migrations/1785797300000-GameResearchCache';

const sqlitePath = process.env.DATABASE_SQLITE_PATH || 'data/local.sqlite';
const safeRuntimeMigrations = [
  AdminAutomation1763760000000,
  SiteContent1785729600000,
  CurrentGameDetails1785736800000,
  GameRecommendations1785795104186,
  GameRecommendationRegistry1785796200000,
  GameResearchCache1785797300000,
];

const getDatabasePort = (): number => {
  const port = Number(process.env.DATABASE_PORT);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : 5432;
};

export function createTypeOrmModuleOptions(): TypeOrmModuleOptions {
  if (process.env.DATABASE_TYPE === 'sqljs') {
    return {
      type: 'sqljs',
      location: sqlitePath,
      autoSave: true,
      autoLoadEntities: true,
      synchronize: true,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: getDatabasePort(),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    autoLoadEntities: true,
    migrations: safeRuntimeMigrations,
    migrationsRun: process.env.NODE_ENV === 'production',
    synchronize: process.env.NODE_ENV !== 'production',
  };
}

export function createTypeOrmDataSourceOptions(): DataSourceOptions {
  if (process.env.DATABASE_TYPE === 'sqljs') {
    return {
      type: 'sqljs',
      location: sqlitePath,
      autoSave: true,
      entities: ['src/**/*.entity{.ts,.js}'],
      synchronize: false,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: getDatabasePort(),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: ['src/**/*.entity{.ts,.js}'],
    migrations: ['src/db/migrations/*{.ts,.js}'],
    synchronize: false,
  };
}

import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';

const sqlitePath = process.env.DATABASE_SQLITE_PATH || 'data/local.sqlite';

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
    migrations: ['db/migrations/*{.ts,.js}'],
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

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { createTypeOrmDataSourceOptions } from './database.config';

dotenv.config();

export const AppDataSource = new DataSource(createTypeOrmDataSourceOptions());

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CampaignModule } from './campaign/campaign.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot(),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT as string, 10) || 5432,
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),

    UsersModule,
    CampaignModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

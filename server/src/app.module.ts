import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CampaignModule } from './campaign/campaign.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { PlayersModule } from './players/players.module';
import { AuthModule } from './auth/auth.module';
import { PoolModule } from './pool/pool.module';
import { AdminModule } from './admin/admin.module';
import { createTypeOrmModuleOptions } from './db/database.config';
import { ContentModule } from './content/content.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),

    TypeOrmModule.forRoot(createTypeOrmModuleOptions()),

    UsersModule,
    CampaignModule,
    PlayersModule,
    GamesModule,
    AuthModule,
    PoolModule,
    ContentModule,
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';
import { AuthModule } from '../auth/auth.module';
import { Campaign } from '../campaign/entities/campaign.entity';
import { Game } from '../games/entities/game.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { CycleController } from './cycle.controller';
import { CycleService } from './cycle.service';
import { DiscordCycleService } from './discord-cycle.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TypeOrmModule.forFeature([AdminAuditLog, Campaign, Game, Pool, PoolOption]),
  ],
  controllers: [CycleController],
  providers: [CycleService, DiscordCycleService],
})
export class CycleModule {}

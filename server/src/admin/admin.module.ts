import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { Game } from '../games/entities/game.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Campaign,
      CampaignPlayer,
      Game,
      Player,
      Pool,
      PoolOption,
      AdminAuditLog,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminApiKeyGuard],
})
export class AdminModule {}

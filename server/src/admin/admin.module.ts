import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { ContentModule } from '../content/content.module';
import { Game } from '../games/entities/game.entity';
import { GameRecommendation } from '../games/entities/game-recommendation.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';
import { MediaModule } from '../media/media.module';
import { AdminMediaController } from './admin-media.controller';

@Module({
  imports: [
    ConfigModule,
    ContentModule,
    MediaModule,
    TypeOrmModule.forFeature([
      Campaign,
      CampaignPlayer,
      Game,
      GameRecommendation,
      Player,
      Pool,
      PoolOption,
      AdminAuditLog,
    ]),
  ],
  controllers: [AdminController, AdminMediaController],
  providers: [AdminService, AdminApiKeyGuard],
})
export class AdminModule {}

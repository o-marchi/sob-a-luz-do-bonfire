import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignPlayer } from './entities/campaign-player.entity';
import { GameRecommendation } from '../games/entities/game-recommendation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignPlayer, GameRecommendation]),
  ],
  controllers: [CampaignController],
  providers: [CampaignService],
})
export class CampaignModule {}

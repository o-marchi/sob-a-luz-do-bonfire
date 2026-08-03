import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignPlayer } from './entities/campaign-player.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, CampaignPlayer])],
  controllers: [CampaignController],
  providers: [CampaignService],
})
export class CampaignModule {}

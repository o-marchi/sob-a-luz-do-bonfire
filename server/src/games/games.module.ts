import { Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { GameRecommendation } from './entities/game-recommendation.entity';
import { GameResearchService } from './game-research.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, PoolOption, Campaign, GameRecommendation]),
  ],
  controllers: [GamesController],
  providers: [GamesService, GameResearchService],
  exports: [TypeOrmModule, GameResearchService],
})
export class GamesModule {}

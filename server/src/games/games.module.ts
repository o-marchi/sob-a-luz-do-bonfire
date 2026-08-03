import { Module } from '@nestjs/common';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { GameRecommendation } from './entities/game-recommendation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, PoolOption, Campaign, GameRecommendation]),
  ],
  controllers: [GamesController],
  providers: [GamesService],
  exports: [TypeOrmModule],
})
export class GamesModule {}

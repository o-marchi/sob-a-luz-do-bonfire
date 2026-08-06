import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { Game } from './entities/game.entity';
import { DeleteResult } from 'typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GameBacklog, GameWithRecommenders } from './games.service';
import {
  AssessGameRecommendationDto,
  CreateGameRecommendationDto,
  SearchGamesQueryDto,
} from './dto/game-recommendation.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentPlayer } from '../auth/decorators/current-player.decorator';
import { Player } from '../players/entities/player.entity';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  create(@Body() createGameDto: CreateGameDto): Promise<Game> {
    return this.gamesService.create(createGameDto);
  }

  @Get()
  findAll(): Promise<Game[]> {
    return this.gamesService.findAll();
  }

  @Get('backlog')
  findBacklog(): Promise<GameBacklog> {
    return this.gamesService.findBacklog();
  }

  @Get('recommendations/search')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  searchRecommendations(@Query() query: SearchGamesQueryDto) {
    return this.gamesService.searchRecommendations(query.query);
  }

  @Post('recommendations/assess')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  assessRecommendation(
    @Body() body: AssessGameRecommendationDto,
    @CurrentPlayer() player: Player,
  ) {
    return this.gamesService.assessRecommendation(body.steamAppId, player);
  }

  @Post('recommendations')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  recommend(
    @Body() body: CreateGameRecommendationDto,
    @CurrentPlayer() player: Player,
  ) {
    return this.gamesService.recommend(body.assessmentToken, player);
  }

  @Delete('recommendations')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  withdrawRecommendation(@CurrentPlayer() player: Player) {
    return this.gamesService.withdrawRecommendation(player);
  }

  @Delete(':id/rotation')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  retireGameFromRotation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPlayer() player: Player,
  ) {
    return this.gamesService.retireGameFromRotation(id, player);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GameWithRecommenders | null> {
    return this.gamesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateGameDto: UpdateGameDto,
  ): Promise<Game> {
    return this.gamesService.update(id, updateGameDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<DeleteResult> {
    return this.gamesService.remove(id);
  }
}

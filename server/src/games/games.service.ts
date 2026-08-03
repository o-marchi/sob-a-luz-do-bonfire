import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { DeleteResult, Repository } from 'typeorm';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { GameRecommendation } from './entities/game-recommendation.entity';

const MAX_BACKLOG_APPEARANCES = 3;

export interface GameRecommender {
  id: number;
  name: string;
  avatar: string | null;
}

export interface GameWithRecommenders extends Game {
  recommendedBy: GameRecommender[];
}

export interface BacklogGame extends GameWithRecommenders {
  electionAppearances: number;
}

export interface GameBacklog {
  games: BacklogGame[];
  rubble: BacklogGame[];
  retirementThreshold: number;
}

const normalizeGameIdentity = (game: Game): string => {
  const steamUrl = game.steam
    ?.trim()
    .replace(/[/?#]+$/, '')
    .toLocaleLowerCase('en-US');

  if (steamUrl) {
    return `steam:${steamUrl}`;
  }

  return `title:${game.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')}`;
};

const gameCompleteness = (game: Game): number =>
  [
    game.cover,
    game.steam,
    game.trailer,
    game.summary,
    game.howLongToBeatUrl,
    game.durationLabel,
  ].filter(Boolean).length;

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(PoolOption)
    private poolOptionRepository: Repository<PoolOption>,
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    @InjectRepository(GameRecommendation)
    private gameRecommendationRepository: Repository<GameRecommendation>,
  ) {}

  create(createGameDto: CreateGameDto): Promise<Game> {
    const entity: Game = this.gameRepository.create(createGameDto);
    return this.gameRepository.save(entity);
  }

  findAll(): Promise<Game[]> {
    return this.gameRepository.find();
  }

  async findBacklog(): Promise<GameBacklog> {
    const [games, poolOptions, campaigns, recommendersByIdentity] =
      await Promise.all([
        this.gameRepository.find({ order: { id: 'ASC' } }),
        this.poolOptionRepository.find({ relations: ['game', 'pool'] }),
        this.campaignRepository.find({ relations: ['game'] }),
        this.findRecommendersByIdentity(),
      ]);

    const gamesByIdentity = new Map<string, Game[]>();
    for (const game of games) {
      const identity = normalizeGameIdentity(game);
      gamesByIdentity.set(identity, [
        ...(gamesByIdentity.get(identity) ?? []),
        game,
      ]);
    }

    const winningIdentities = new Set(
      campaigns
        .map((campaign) => campaign.game)
        .filter((game): game is Game => Boolean(game))
        .map(normalizeGameIdentity),
    );

    const appearancesByIdentity = new Map<string, Set<number>>();
    for (const option of poolOptions) {
      const identity = normalizeGameIdentity(option.game);
      const poolIds = appearancesByIdentity.get(identity) ?? new Set<number>();
      poolIds.add(option.pool.id);
      appearancesByIdentity.set(identity, poolIds);
    }

    const backlogGames: BacklogGame[] = [];
    const rubbleGames: BacklogGame[] = [];
    for (const [identity, matchingGames] of gamesByIdentity) {
      if (
        !matchingGames.some((game) => game.suggestion) ||
        winningIdentities.has(identity)
      ) {
        continue;
      }

      const electionAppearances =
        appearancesByIdentity.get(identity)?.size ?? 0;
      const game = [...matchingGames].sort(
        (left, right) =>
          gameCompleteness(right) - gameCompleteness(left) ||
          left.id - right.id,
      )[0];

      const backlogGame = {
        ...game,
        electionAppearances,
        recommendedBy: recommendersByIdentity.get(identity) ?? [],
      };
      if (electionAppearances >= MAX_BACKLOG_APPEARANCES) {
        rubbleGames.push(backlogGame);
      } else {
        backlogGames.push(backlogGame);
      }
    }

    backlogGames.sort(
      (left, right) =>
        (left.electionAppearances || Number.MAX_SAFE_INTEGER) -
          (right.electionAppearances || Number.MAX_SAFE_INTEGER) ||
        left.title.localeCompare(right.title, 'pt-BR'),
    );

    rubbleGames.sort(
      (left, right) =>
        right.electionAppearances - left.electionAppearances ||
        left.title.localeCompare(right.title, 'pt-BR'),
    );

    return {
      games: backlogGames,
      rubble: rubbleGames,
      retirementThreshold: MAX_BACKLOG_APPEARANCES,
    };
  }

  async findOne(id: number): Promise<GameWithRecommenders | null> {
    const game = await this.gameRepository.findOneBy({ id });

    if (!game) {
      return null;
    }

    const recommendersByIdentity = await this.findRecommendersByIdentity();
    return {
      ...game,
      recommendedBy:
        recommendersByIdentity.get(normalizeGameIdentity(game)) ?? [],
    };
  }

  private async findRecommendersByIdentity(): Promise<
    Map<string, GameRecommender[]>
  > {
    const recommendations = await this.gameRecommendationRepository.find({
      relations: ['game', 'player'],
    });
    const recommendersByIdentity = new Map<
      string,
      Map<number, GameRecommender>
    >();

    for (const recommendation of recommendations) {
      const identity = normalizeGameIdentity(recommendation.game);
      const recommenders =
        recommendersByIdentity.get(identity) ??
        new Map<number, GameRecommender>();
      const player = recommendation.player;
      recommenders.set(player.id, {
        id: player.id,
        name:
          player.discord?.globalName ??
          player.name ??
          player.discord?.username ??
          'Participante',
        avatar: player.discord?.avatar ?? null,
      });
      recommendersByIdentity.set(identity, recommenders);
    }

    return new Map(
      Array.from(recommendersByIdentity, ([identity, recommenders]) => [
        identity,
        Array.from(recommenders.values()).sort((left, right) =>
          left.name.localeCompare(right.name, 'pt-BR'),
        ),
      ]),
    );
  }

  async update(id: number, updateGameDto: UpdateGameDto): Promise<Game> {
    const entity: Game | undefined = await this.gameRepository.preload({
      id,
      ...updateGameDto,
    });

    if (!entity) {
      throw new NotFoundException(`Game #${id} not found`);
    }

    return this.gameRepository.save(entity);
  }

  remove(id: number): Promise<DeleteResult> {
    return this.gameRepository.delete(id);
  }
}

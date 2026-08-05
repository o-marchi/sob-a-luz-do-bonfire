import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { DataSource, DeleteResult, EntityManager, Repository } from 'typeorm';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { GameRecommendation } from './entities/game-recommendation.entity';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Player } from '../players/entities/player.entity';
import {
  GameResearchAssessment,
  GameResearchService,
  ResearchedGame,
  SteamGameSearchResult,
  normalizeGameTitle,
} from './game-research.service';

const MAX_BACKLOG_APPEARANCES = 3;
export const TARGET_POOL_SIZE = 5;

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
  guaranteedNextVote: boolean;
}

export interface GameBacklog {
  games: BacklogGame[];
  rubble: BacklogGame[];
  retirementThreshold: number;
  targetPoolSize: number;
  nextVoteFillCount: number;
}

export interface RecommendationAssessment extends GameResearchAssessment {
  assessmentToken?: string;
  existingSuggestion?: Pick<Game, 'id' | 'title'>;
}

export interface CreatedGameRecommendation {
  game: GameWithRecommenders;
  created: boolean;
  alreadyRecommended: boolean;
  electionAppearances: number;
}

export interface WithdrawnGameRecommendation {
  game: Game;
  hiddenFromCatalog: boolean;
}

export const extractSteamAppId = (steamUrl?: string | null): number | null => {
  const match = steamUrl?.match(/store\.steampowered\.com\/app\/(\d+)/i);
  const appId = match ? Number(match[1]) : NaN;
  return Number.isInteger(appId) && appId > 0 ? appId : null;
};

export const normalizeGameIdentity = (game: Game): string => {
  const steamAppId = extractSteamAppId(game.steam);

  if (steamAppId) {
    return `steam:${steamAppId}`;
  }

  return `title:${normalizeGameTitle(game.title)}`;
};

const gameCompleteness = (game: Game): number =>
  [
    game.cover,
    game.steam,
    game.trailer,
    game.summary,
    game.howLongToBeatUrl,
    game.durationLabel,
    game.mainExtraHours,
    game.howLongToBeatTitle,
  ].filter(Boolean).length;

export const findGuaranteedNextVoteGames = async (
  manager: EntityManager,
): Promise<Game[]> => {
  const campaign = await manager.getRepository(Campaign).findOne({
    where: { current: true },
    relations: ['players', 'players.suggestedGame'],
  });
  const gamesByIdentity = new Map<string, Game[]>();

  for (const campaignPlayer of campaign?.players ?? []) {
    const game = campaignPlayer.suggestedGame;
    if (!game) continue;
    const identity = normalizeGameIdentity(game);
    gamesByIdentity.set(identity, [
      ...(gamesByIdentity.get(identity) ?? []),
      game,
    ]);
  }

  return Array.from(gamesByIdentity.values())
    .map(
      (matchingGames) =>
        [...matchingGames].sort(
          (left, right) =>
            gameCompleteness(right) - gameCompleteness(left) ||
            left.id - right.id,
        )[0],
    )
    .sort((left, right) => left.title.localeCompare(right.title, 'pt-BR'));
};

export const findEligibleBacklogGames = async (
  manager: EntityManager,
  excludedIdentities: Set<string>,
): Promise<Game[]> => {
  const [games, poolOptions, campaigns] = await Promise.all([
    manager.getRepository(Game).find({ order: { id: 'ASC' } }),
    manager.getRepository(PoolOption).find({ relations: ['game', 'pool'] }),
    manager.getRepository(Campaign).find({ relations: ['game'] }),
  ]);
  const winningIdentities = new Set(
    campaigns
      .map((campaign) => campaign.game)
      .filter((game): game is Game => Boolean(game))
      .map(normalizeGameIdentity),
  );
  const appearancesByIdentity = new Map<string, Set<number>>();
  const gamesByIdentity = new Map<string, Game[]>();

  for (const option of poolOptions) {
    if (!option.pool) continue;
    const identity = normalizeGameIdentity(option.game);
    const poolIds = appearancesByIdentity.get(identity) ?? new Set<number>();
    poolIds.add(option.pool.id);
    appearancesByIdentity.set(identity, poolIds);
  }

  for (const game of games) {
    const identity = normalizeGameIdentity(game);
    gamesByIdentity.set(identity, [
      ...(gamesByIdentity.get(identity) ?? []),
      game,
    ]);
  }

  return Array.from(gamesByIdentity, ([identity, matchingGames]) => ({
    identity,
    appearances: appearancesByIdentity.get(identity)?.size ?? 0,
    game: [...matchingGames].sort(
      (left, right) =>
        gameCompleteness(right) - gameCompleteness(left) || left.id - right.id,
    )[0],
  }))
    .filter(
      ({ identity, appearances, game }) =>
        game.suggestion &&
        !excludedIdentities.has(identity) &&
        !winningIdentities.has(identity) &&
        appearances < MAX_BACKLOG_APPEARANCES,
    )
    .sort(
      (left, right) =>
        left.appearances - right.appearances ||
        left.game.title.localeCompare(right.game.title, 'pt-BR'),
    )
    .map(({ game }) => game);
};

export const buildNextVotePoolGames = async (
  manager: EntityManager,
  requestedGames: Game[],
  reservedSlots = 0,
): Promise<Game[]> => {
  const gamesByIdentity = new Map<string, Game>();

  for (const game of requestedGames) {
    gamesByIdentity.set(normalizeGameIdentity(game), game);
  }

  for (const game of await findGuaranteedNextVoteGames(manager)) {
    gamesByIdentity.set(normalizeGameIdentity(game), game);
  }

  const persistedTarget = Math.max(0, TARGET_POOL_SIZE - reservedSlots);
  if (gamesByIdentity.size < persistedTarget) {
    const fillerGames = await findEligibleBacklogGames(
      manager,
      new Set(gamesByIdentity.keys()),
    );

    for (const game of fillerGames) {
      if (gamesByIdentity.size >= persistedTarget) break;
      gamesByIdentity.set(normalizeGameIdentity(game), game);
    }
  }

  return Array.from(gamesByIdentity.values());
};

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
    private readonly dataSource: DataSource,
    private readonly gameResearchService: GameResearchService,
  ) {}

  create(createGameDto: CreateGameDto): Promise<Game> {
    const entity: Game = this.gameRepository.create(createGameDto);
    return this.gameRepository.save(entity);
  }

  findAll(): Promise<Game[]> {
    return this.gameRepository.find();
  }

  async searchRecommendations(query: string): Promise<SteamGameSearchResult[]> {
    const normalizedQuery = normalizeGameTitle(query);
    const localResults = (
      await this.gameRepository.find({ order: { title: 'ASC' } })
    )
      .filter((game) =>
        normalizeGameTitle(game.title).includes(normalizedQuery),
      )
      .map((game) => ({ game, steamAppId: extractSteamAppId(game.steam) }))
      .filter(
        (entry): entry is { game: Game; steamAppId: number } =>
          entry.steamAppId !== null,
      )
      .map(({ game, steamAppId }) => ({
        steamAppId,
        title: game.title,
        image: game.cover ?? null,
        source: 'catalog' as const,
      }));

    let steamResults: SteamGameSearchResult[] = [];
    try {
      steamResults = await this.gameResearchService.searchSteam(query);
    } catch (error) {
      if (!localResults.length) throw error;
    }

    const resultsByAppId = new Map<number, SteamGameSearchResult>();
    for (const result of [...localResults, ...steamResults]) {
      if (!resultsByAppId.has(result.steamAppId)) {
        resultsByAppId.set(result.steamAppId, result);
      }
    }

    return Array.from(resultsByAppId.values()).slice(0, 8);
  }

  async assessRecommendation(
    steamAppId: number,
    player: Player,
  ): Promise<RecommendationAssessment> {
    const campaign = await this.campaignRepository.findOne({
      where: { current: true },
      relations: ['game', 'players', 'players.player', 'players.suggestedGame'],
    });

    if (!campaign) {
      throw new NotFoundException('No current campaign found');
    }

    const localGame = (await this.gameRepository.find()).find(
      (game) => extractSteamAppId(game.steam) === steamAppId,
    );
    const cachedResearch = localGame
      ? this.getCachedResearch(localGame, steamAppId)
      : null;
    const assessment = cachedResearch
      ? this.gameResearchService.assessResearchedGame(cachedResearch)
      : await this.gameResearchService.assessSteamGame(steamAppId);
    if (!assessment.eligible) return assessment;

    const campaignPlayer = campaign.players.find(
      (entry) => entry.player.id === player.id,
    );
    if (campaignPlayer?.suggestedGame) {
      return {
        ...assessment,
        eligible: false,
        reason: 'already_suggested',
        existingSuggestion: {
          id: campaignPlayer.suggestedGame.id,
          title: campaignPlayer.suggestedGame.title,
        },
      };
    }

    const matchingGame = await this.findEquivalentGame(
      this.dataSource.manager,
      assessment.game,
    );
    if (matchingGame && (await this.hasWonCampaign(matchingGame))) {
      return { ...assessment, eligible: false, reason: 'already_played' };
    }

    return {
      ...assessment,
      assessmentToken: this.gameResearchService.issueAssessmentToken(
        assessment.game,
        player.id,
      ),
    };
  }

  async recommend(
    assessmentToken: string,
    player: Player,
  ): Promise<CreatedGameRecommendation> {
    let researchedGame: ResearchedGame;

    try {
      researchedGame = this.gameResearchService.verifyAssessmentToken(
        assessmentToken,
        player.id,
      );
    } catch {
      throw new BadRequestException(
        'A verificação expirou. Selecione o jogo novamente.',
      );
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const campaign = await manager.getRepository(Campaign).findOne({
        where: { current: true },
        relations: [
          'game',
          'players',
          'players.player',
          'players.suggestedGame',
        ],
      });

      if (!campaign) {
        throw new NotFoundException('No current campaign found');
      }

      let game = await this.findEquivalentGame(manager, researchedGame);
      const alreadySuggestedGame = campaign.players.find(
        (entry) => entry.player.id === player.id,
      )?.suggestedGame;

      if (alreadySuggestedGame) {
        const sameGame = game
          ? normalizeGameIdentity(alreadySuggestedGame) ===
            normalizeGameIdentity(game)
          : extractSteamAppId(alreadySuggestedGame.steam) ===
            researchedGame.steamAppId;

        if (!sameGame) {
          throw new BadRequestException(
            `Você já sugeriu ${alreadySuggestedGame.title} neste ciclo.`,
          );
        }

        return {
          game: alreadySuggestedGame,
          created: false,
          alreadyRecommended: true,
        };
      }

      if (game && (await this.hasWonCampaign(game, manager))) {
        throw new BadRequestException(
          'Este jogo já foi escolhido pelo grupo em outra campanha.',
        );
      }

      const created = !game;
      const gameRepository = manager.getRepository(Game);
      game ??= gameRepository.create({
        title: researchedGame.title,
        suggestion: true,
        cover: researchedGame.cover,
        steam: researchedGame.steam,
        trailer: researchedGame.trailer,
        summary: researchedGame.summary,
        howLongToBeatUrl: researchedGame.howLongToBeatUrl,
        durationLabel: researchedGame.durationLabel,
      });
      game.suggestion = true;
      game.cover ||= researchedGame.cover;
      game.steam ||= researchedGame.steam;
      game.trailer ||= researchedGame.trailer;
      game.summary ||= researchedGame.summary;
      game.howLongToBeatUrl ||= researchedGame.howLongToBeatUrl;
      game.durationLabel ||= researchedGame.durationLabel;
      game.mainHours ??= researchedGame.mainHours;
      game.mainExtraHours ??= researchedGame.mainExtraHours;
      game.howLongToBeatTitle ||= researchedGame.howLongToBeatTitle;
      game = await gameRepository.save(game);

      await manager
        .getRepository(GameRecommendation)
        .createQueryBuilder()
        .insert()
        .values({ game, player })
        .orIgnore()
        .execute();

      const campaignPlayerRepository = manager.getRepository(CampaignPlayer);
      let campaignPlayer = campaign.players.find(
        (entry) => entry.player.id === player.id,
      );
      campaignPlayer ??= campaignPlayerRepository.create({
        campaign,
        player,
        played_the_game: false,
        finished_the_game: false,
        partook_in_the_meeting: false,
        suggested_a_game: false,
        suggestedGame: null,
      });
      campaignPlayer.suggested_a_game = true;
      campaignPlayer.suggestedGame = game;
      await campaignPlayerRepository.save(campaignPlayer);

      return { game, created, alreadyRecommended: false };
    });

    const [game, electionAppearances] = await Promise.all([
      this.findOne(result.game.id),
      this.countElectionAppearances(result.game),
    ]);

    if (!game) {
      throw new NotFoundException(`Game #${result.game.id} not found`);
    }

    return { ...result, game, electionAppearances };
  }

  async withdrawRecommendation(
    player: Player,
  ): Promise<WithdrawnGameRecommendation> {
    return this.dataSource.transaction(async (manager) => {
      const campaign = await manager.getRepository(Campaign).findOne({
        where: { current: true },
        relations: ['players', 'players.player', 'players.suggestedGame'],
      });

      if (!campaign) {
        throw new NotFoundException('No current campaign found');
      }

      const campaignPlayer = campaign.players.find(
        (entry) => entry.player.id === player.id,
      );
      const game = campaignPlayer?.suggestedGame;
      if (!campaignPlayer || !game) {
        throw new BadRequestException(
          'Você ainda não sugeriu um jogo neste ciclo.',
        );
      }

      campaignPlayer.suggested_a_game = false;
      campaignPlayer.suggestedGame = null;
      await manager.getRepository(CampaignPlayer).save(campaignPlayer);

      const identity = normalizeGameIdentity(game);
      const activeSuggestionCount = campaign.players.filter(
        (entry) =>
          entry.suggestedGame &&
          normalizeGameIdentity(entry.suggestedGame) === identity,
      ).length;
      const appearances = await manager.getRepository(PoolOption).find({
        relations: ['game', 'pool'],
      });
      const appearanceCount = new Set(
        appearances
          .filter((option) => normalizeGameIdentity(option.game) === identity)
          .map((option) => option.pool.id),
      ).size;
      const hiddenFromCatalog =
        activeSuggestionCount === 0 && appearanceCount === 0;

      if (hiddenFromCatalog) {
        game.suggestion = false;
        await manager.getRepository(Game).save(game);
      }

      return { game, hiddenFromCatalog };
    });
  }

  async findBacklog(): Promise<GameBacklog> {
    const [games, poolOptions, campaigns, recommendersByIdentity] =
      await Promise.all([
        this.gameRepository.find({ order: { id: 'ASC' } }),
        this.poolOptionRepository.find({ relations: ['game', 'pool'] }),
        this.campaignRepository.find({
          relations: ['game', 'players', 'players.suggestedGame'],
        }),
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
    const guaranteedIdentities = new Set(
      (campaigns.find((campaign) => campaign.current)?.players ?? [])
        .map((campaignPlayer) => campaignPlayer.suggestedGame)
        .filter((game): game is Game => Boolean(game))
        .map(normalizeGameIdentity),
    );

    const appearancesByIdentity = new Map<string, Set<number>>();
    for (const option of poolOptions) {
      if (!option.pool) continue;
      const identity = normalizeGameIdentity(option.game);
      const poolIds = appearancesByIdentity.get(identity) ?? new Set<number>();
      poolIds.add(option.pool.id);
      appearancesByIdentity.set(identity, poolIds);
    }

    const backlogGames: BacklogGame[] = [];
    const rubbleGames: BacklogGame[] = [];
    for (const [identity, matchingGames] of gamesByIdentity) {
      const guaranteedNextVote = guaranteedIdentities.has(identity);
      if (
        (!matchingGames.some((game) => game.suggestion) &&
          !guaranteedNextVote) ||
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
        guaranteedNextVote,
        recommendedBy: recommendersByIdentity.get(identity) ?? [],
      };
      if (
        !guaranteedNextVote &&
        electionAppearances >= MAX_BACKLOG_APPEARANCES
      ) {
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
      targetPoolSize: TARGET_POOL_SIZE,
      nextVoteFillCount: Math.min(
        Math.max(0, TARGET_POOL_SIZE - guaranteedIdentities.size),
        backlogGames.filter((game) => !game.guaranteedNextVote).length,
      ),
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

  private async findEquivalentGame(
    manager: EntityManager,
    researchedGame: ResearchedGame,
  ): Promise<Game | null> {
    const games = await manager.getRepository(Game).find();
    const normalizedTitle = normalizeGameTitle(researchedGame.title);

    return (
      games.find(
        (game) => extractSteamAppId(game.steam) === researchedGame.steamAppId,
      ) ??
      games.find(
        (game) => normalizeGameTitle(game.title) === normalizedTitle,
      ) ??
      null
    );
  }

  private getCachedResearch(
    game: Game,
    steamAppId: number,
  ): ResearchedGame | null {
    if (game.mainExtraHours === null || game.mainExtraHours === undefined) {
      return null;
    }

    return {
      steamAppId,
      title: game.title,
      cover: game.cover ?? null,
      steam: game.steam ?? `https://store.steampowered.com/app/${steamAppId}/`,
      trailer: game.trailer ?? null,
      summary: game.summary ?? null,
      howLongToBeatUrl: game.howLongToBeatUrl ?? null,
      durationLabel: game.durationLabel ?? null,
      mainHours: game.mainHours ?? null,
      mainExtraHours: game.mainExtraHours,
      howLongToBeatTitle: game.howLongToBeatTitle ?? game.title,
    };
  }

  private async hasWonCampaign(
    game: Game,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<boolean> {
    const campaigns = await manager.getRepository(Campaign).find({
      relations: ['game'],
    });
    const identity = normalizeGameIdentity(game);

    return campaigns.some(
      (campaign) =>
        campaign.game && normalizeGameIdentity(campaign.game) === identity,
    );
  }

  private async countElectionAppearances(game: Game): Promise<number> {
    const options = await this.poolOptionRepository.find({
      relations: ['game', 'pool'],
    });
    const identity = normalizeGameIdentity(game);

    return new Set(
      options
        .filter((option) => normalizeGameIdentity(option.game) === identity)
        .map((option) => option.pool.id),
    ).size;
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

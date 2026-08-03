import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { ContentService } from '../content/content.service';
import { SiteContent } from '../content/entities/site-content.entity';
import { Game } from '../games/entities/game.entity';
import { GameRecommendation } from '../games/entities/game-recommendation.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import {
  AttachPoolToCampaignDto,
  BulkCampaignParticipantsDto,
  CreatePoolFromGamesDto,
  FinalizeElectionDto,
  UpdateCampaignAdminDto,
  UpsertGamesDto,
} from './dto/admin-operations.dto';
import {
  AdminCampaignInputDto,
  AdminGameRecommendationInputDto,
  AdminGameInputDto,
  AdminParticipantInputDto,
  AdminPlayerReferenceDto,
  AdminPoolInputDto,
  ApplyMonthlyPlanDto,
  MonthlyPlanDto,
} from './dto/monthly-plan.dto';
import { UpdateRulesDto } from './dto/update-rules.dto';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

type ParticipantFlag =
  | 'played_the_game'
  | 'finished_the_game'
  | 'partook_in_the_meeting'
  | 'suggested_a_game';

type PreviewActionType = 'create' | 'update' | 'reuse' | 'skip';

export interface PreviewAction {
  type: PreviewActionType;
  entity: string;
  label: string;
  details?: Record<string, unknown>;
}

export interface MonthlyPlanPreview {
  valid: boolean;
  confirmationToken: string | null;
  actions: PreviewAction[];
  warnings: string[];
  errors: string[];
}

export interface ElectionResultOption {
  optionId: number;
  gameId: number;
  game: string;
  tokens: number;
  voters: string[];
}

interface SuggestedGameReference {
  id?: number;
  title: string;
}

const campaignRelations = [
  'game',
  'players',
  'players.player',
  'players.suggestedGame',
  'pool',
  'pool.options',
  'pool.options.game',
  'pool.options.players',
];

const poolRelations = ['options', 'options.game', 'options.players'];

const participantFlags: ParticipantFlag[] = [
  'played_the_game',
  'finished_the_game',
  'partook_in_the_meeting',
  'suggested_a_game',
];

const normalizeText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

const compact = <T>(values: Array<T | null | undefined>): T[] =>
  values.filter((value): value is T => value !== null && value !== undefined);

const sortedUniqueNumbers = (values: number[]): number[] =>
  Array.from(new Set(values)).sort((a, b) => a - b);

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(',')}}`;
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignPlayer)
    private readonly campaignPlayerRepository: Repository<CampaignPlayer>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(GameRecommendation)
    private readonly gameRecommendationRepository: Repository<GameRecommendation>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(Pool)
    private readonly poolRepository: Repository<Pool>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly contentService: ContentService,
  ) {}

  async getState(): Promise<{
    currentCampaign: Campaign | null;
    games: Game[];
    players: Player[];
    pools: Pool[];
  }> {
    const [currentCampaign, games, players, pools] = await Promise.all([
      this.findCurrentCampaign(),
      this.gameRepository.find({ order: { title: 'ASC' } }),
      this.playerRepository.find({ order: { name: 'ASC', email: 'ASC' } }),
      this.poolRepository.find({
        relations: poolRelations,
        order: { id: 'DESC' },
      }),
    ]);

    return { currentCampaign, games, players, pools };
  }

  async listGames(query?: string): Promise<Game[]> {
    const games = await this.gameRepository.find({ order: { title: 'ASC' } });

    if (!query?.trim()) {
      return games;
    }

    const normalizedQuery = normalizeText(query);
    return games.filter(
      (game) =>
        normalizeText(game.title).includes(normalizedQuery) ||
        normalizeText(game.steam ?? '').includes(normalizedQuery),
    );
  }

  async listPlayers(query?: string): Promise<Player[]> {
    const players = await this.playerRepository.find({
      order: { name: 'ASC', email: 'ASC' },
    });

    if (!query?.trim()) {
      return players;
    }

    const normalizedQuery = normalizeText(query);
    return players.filter((player) =>
      [
        player.name,
        player.email,
        player.discord?.username,
        player.discord?.globalName,
      ].some((value) =>
        value ? normalizeText(value).includes(normalizedQuery) : false,
      ),
    );
  }

  getRules(): Promise<SiteContent> {
    return this.contentService.getRules();
  }

  async updateRules(dto: UpdateRulesDto): Promise<SiteContent> {
    return this.dataSource.transaction(async (manager) => {
      const rules = await this.contentService.updateRules(dto.content, manager);

      await this.writeAuditLog(manager, 'rules_updated', dto, {
        key: rules.key,
        updatedAt: rules.updatedAt,
      });

      return rules;
    });
  }

  async previewMonthlyPlan(plan: MonthlyPlanDto): Promise<MonthlyPlanPreview> {
    const actions: PreviewAction[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    await this.previewCampaign(plan, actions, errors);
    await this.previewGames(plan.games ?? [], actions, warnings, errors);
    await this.previewPool(plan, actions, warnings, errors);
    await this.previewParticipants(plan, actions, warnings, errors);
    await this.previewRecommendations(plan, actions, warnings, errors);

    return {
      valid: errors.length === 0,
      confirmationToken:
        errors.length === 0 ? this.buildConfirmationToken(plan) : null,
      actions,
      warnings,
      errors,
    };
  }

  async applyMonthlyPlan(dto: ApplyMonthlyPlanDto): Promise<{
    preview: MonthlyPlanPreview;
    campaign: Campaign;
  }> {
    if (!dto.confirm) {
      throw new BadRequestException('confirm must be true to apply a plan');
    }

    const plan = this.extractMonthlyPlan(dto);
    const preview = await this.previewMonthlyPlan(plan);

    if (!preview.valid) {
      throw new BadRequestException({
        message: 'Monthly plan has validation errors',
        errors: preview.errors,
        warnings: preview.warnings,
      });
    }

    const expectedToken = this.buildConfirmationToken(plan);

    if (!this.safeTokenEquals(dto.confirmationToken, expectedToken)) {
      throw new BadRequestException(
        'Invalid confirmation token. Run preview_monthly_plan again and use the returned token.',
      );
    }

    const campaign = await this.dataSource.transaction(async (manager) => {
      const savedGames = await this.upsertGamesInTransaction(
        manager,
        plan.games ?? [],
      );
      const campaignEntity = await this.resolveOrCreateCampaign(
        manager,
        plan.campaign,
      );

      await this.applyCampaignFields(
        manager,
        campaignEntity,
        plan.campaign,
        savedGames,
      );

      if (plan.pool) {
        const pool = await this.resolveOrCreatePool(
          manager,
          plan.pool,
          plan.games ?? [],
          savedGames,
        );

        if (plan.pool.attachToCampaign !== false) {
          campaignEntity.pool = pool;
        }
      }

      const savedCampaign = await this.saveCampaignWithCurrentHandling(
        manager,
        campaignEntity,
        plan.campaign,
      );

      await this.applyParticipants(
        manager,
        savedCampaign,
        plan.participants ?? [],
        savedGames,
      );

      await this.applyRecommendations(
        manager,
        plan.recommendations ?? [],
        savedGames,
      );

      await this.writeAuditLog(manager, 'monthly_plan_applied', plan, {
        campaignId: savedCampaign.id,
      });

      return this.findCampaignOrFail(manager, savedCampaign.id);
    });

    return { preview, campaign };
  }

  async upsertGames(dto: UpsertGamesDto): Promise<Game[]> {
    return this.dataSource.transaction(async (manager) => {
      const savedGameMap = await this.upsertGamesInTransaction(
        manager,
        dto.games,
      );
      const savedGames = Array.from(savedGameMap.values());

      await this.writeAuditLog(manager, 'games_upserted', dto, {
        gameIds: savedGames.map((game) => game.id),
      });

      return savedGames;
    });
  }

  async createPoolFromGames(dto: CreatePoolFromGamesDto): Promise<Pool> {
    return this.dataSource.transaction(async (manager) => {
      const pool = await this.resolveOrCreatePool(manager, dto, [], new Map());

      if (dto.campaignId) {
        const campaign = await this.findCampaignOrFail(manager, dto.campaignId);
        campaign.pool = pool;
        await manager.getRepository(Campaign).save(campaign);
      }

      await this.writeAuditLog(manager, 'pool_created_or_reused', dto, {
        poolId: pool.id,
        campaignId: dto.campaignId ?? null,
      });

      return pool;
    });
  }

  async attachPoolToCampaign(dto: AttachPoolToCampaignDto): Promise<Campaign> {
    return this.dataSource.transaction(async (manager) => {
      const campaign = dto.campaignId
        ? await this.findCampaignOrFail(manager, dto.campaignId)
        : await this.findCurrentCampaignOrFail(manager);
      const pool = await this.findPoolOrFail(manager, dto.poolId);

      campaign.pool = pool;
      await manager.getRepository(Campaign).save(campaign);

      await this.writeAuditLog(manager, 'pool_attached_to_campaign', dto, {
        campaignId: campaign.id,
        poolId: pool.id,
      });

      return this.findCampaignOrFail(manager, campaign.id);
    });
  }

  async updateCampaign(
    campaignId: number | 'current',
    dto: UpdateCampaignAdminDto,
  ): Promise<Campaign> {
    return this.dataSource.transaction(async (manager) => {
      const campaign =
        campaignId === 'current'
          ? await this.findCurrentCampaignOrFail(manager)
          : await this.findCampaignOrFail(manager, campaignId);

      await this.applyCampaignFields(manager, campaign, dto, new Map());
      const savedCampaign = await this.saveCampaignWithCurrentHandling(
        manager,
        campaign,
        dto,
      );

      await this.writeAuditLog(manager, 'campaign_updated', dto, {
        campaignId: savedCampaign.id,
      });

      return this.findCampaignOrFail(manager, savedCampaign.id);
    });
  }

  async bulkUpdateCampaignParticipants(
    campaignId: number | 'current',
    dto: BulkCampaignParticipantsDto,
  ): Promise<Campaign> {
    return this.dataSource.transaction(async (manager) => {
      const campaign =
        campaignId === 'current'
          ? await this.findCurrentCampaignOrFail(manager)
          : await this.findCampaignOrFail(manager, campaignId);

      await this.applyParticipants(manager, campaign, dto.participants);

      await this.writeAuditLog(manager, 'campaign_participants_updated', dto, {
        campaignId: campaign.id,
      });

      return this.findCampaignOrFail(manager, campaign.id);
    });
  }

  async getElectionResult(
    campaignId: number | 'current' = 'current',
  ): Promise<ElectionResultOption[]> {
    const campaign =
      campaignId === 'current'
        ? await this.findCurrentCampaignOrFail()
        : await this.findCampaignOrFail(this.dataSource.manager, campaignId);

    return this.calculateElectionResult(campaign);
  }

  async finalizeElection(
    campaignId: number | 'current',
    dto: FinalizeElectionDto,
  ): Promise<{ campaign: Campaign; result: ElectionResultOption[] }> {
    return this.dataSource.transaction(async (manager) => {
      const campaign =
        campaignId === 'current'
          ? await this.findCurrentCampaignOrFail(manager)
          : await this.findCampaignOrFail(manager, campaignId);

      const result = this.calculateElectionResult(campaign);

      if (result.length === 0) {
        throw new BadRequestException('Campaign has no pool options');
      }

      const highestTokens = Math.max(...result.map((option) => option.tokens));
      const winners = result.filter(
        (option) => option.tokens === highestTokens,
      );

      if (winners.length > 1 && !dto.allowTie) {
        throw new BadRequestException({
          message:
            'Election has a tie. Pass allowTie=true to pick the first tied option intentionally.',
          result,
        });
      }

      const winningGame = await manager.getRepository(Game).findOneByOrFail({
        id: winners[0].gameId,
      });

      campaign.game = winningGame;
      campaign.electionActive = false;
      await manager.getRepository(Campaign).save(campaign);

      await this.writeAuditLog(manager, 'election_finalized', dto, {
        campaignId: campaign.id,
        winningGameId: winningGame.id,
        result,
      });

      return {
        campaign: await this.findCampaignOrFail(manager, campaign.id),
        result,
      };
    });
  }

  private async previewCampaign(
    plan: MonthlyPlanDto,
    actions: PreviewAction[],
    errors: string[],
  ): Promise<void> {
    const campaign = await this.resolveCampaignForPreview(plan.campaign);

    if (!campaign) {
      if (plan.campaign?.month && plan.campaign?.year) {
        actions.push({
          type: 'create',
          entity: 'campaign',
          label: `${plan.campaign.month} ${plan.campaign.year}`,
        });
      } else if (
        plan.campaign ||
        plan.pool ||
        (plan.participants?.length ?? 0) > 0
      ) {
        errors.push(
          'No current campaign found. Provide campaign.id or campaign.month/year to create one.',
        );
      }

      return;
    }

    const changes: Record<string, unknown> = {};
    const input = plan.campaign;

    if (!input) {
      return;
    }

    if (input.month && input.month !== campaign.month) {
      changes.month = { from: campaign.month, to: input.month };
    }

    if (input.year && input.year !== campaign.year) {
      changes.year = { from: campaign.year, to: input.year };
    }

    if (
      input.description !== undefined &&
      input.description !== campaign.description
    ) {
      changes.description = 'changed';
    }

    if (
      input.meetingAt !== undefined &&
      input.meetingAt !== campaign.meetingAt
    ) {
      changes.meetingAt = {
        from: campaign.meetingAt ?? null,
        to: input.meetingAt,
      };
    }

    if (
      input.meetingLocation !== undefined &&
      input.meetingLocation !== campaign.meetingLocation
    ) {
      changes.meetingLocation = {
        from: campaign.meetingLocation ?? null,
        to: input.meetingLocation,
      };
    }

    if (
      input.meetingUrl !== undefined &&
      input.meetingUrl !== campaign.meetingUrl
    ) {
      changes.meetingUrl = {
        from: campaign.meetingUrl ?? null,
        to: input.meetingUrl,
      };
    }

    if (
      input.electionActive !== undefined &&
      input.electionActive !== campaign.electionActive
    ) {
      changes.electionActive = {
        from: campaign.electionActive,
        to: input.electionActive,
      };
    }

    if (input.gameId && input.gameId !== campaign.game?.id) {
      changes.gameId = { from: campaign.game?.id ?? null, to: input.gameId };
    }

    if (input.poolId && input.poolId !== campaign.pool?.id) {
      changes.poolId = { from: campaign.pool?.id ?? null, to: input.poolId };
    }

    if (
      (input.current === true || input.setCurrent === true) &&
      !campaign.current
    ) {
      changes.current = { from: false, to: true };
    }

    if (Object.keys(changes).length > 0) {
      actions.push({
        type: 'update',
        entity: 'campaign',
        label: `${campaign.month} ${campaign.year} (#${campaign.id})`,
        details: changes,
      });
    }
  }

  private async previewGames(
    games: AdminGameInputDto[],
    actions: PreviewAction[],
    warnings: string[],
    errors: string[],
  ): Promise<void> {
    const seenTitles = new Set<string>();

    for (const input of games) {
      if (!input.id && !input.title?.trim()) {
        errors.push('Every game must have either id or title.');
        continue;
      }

      if (input.title) {
        const normalizedTitle = normalizeText(input.title);

        if (seenTitles.has(normalizedTitle)) {
          warnings.push(`Duplicate game in plan: ${input.title}`);
        }

        seenTitles.add(normalizedTitle);
      }

      const existingGame = await this.findGameByInput(
        this.dataSource.manager,
        input,
      );

      if (!existingGame) {
        actions.push({
          type: 'create',
          entity: 'game',
          label: input.title ?? `#${input.id}`,
        });
        continue;
      }

      const changes = this.describeGameChanges(existingGame, input);

      actions.push(
        Object.keys(changes).length > 0
          ? {
              type: 'update',
              entity: 'game',
              label: `${existingGame.title} (#${existingGame.id})`,
              details: changes,
            }
          : {
              type: 'reuse',
              entity: 'game',
              label: `${existingGame.title} (#${existingGame.id})`,
            },
      );
    }
  }

  private async previewPool(
    plan: MonthlyPlanDto,
    actions: PreviewAction[],
    warnings: string[],
    errors: string[],
  ): Promise<void> {
    if (!plan.pool) {
      return;
    }

    const poolGames = await this.resolvePoolGamesForPreview(
      plan.pool,
      plan.games ?? [],
      warnings,
      errors,
    );

    if (poolGames.length === 0) {
      errors.push(
        'Pool needs gameIds, gameTitles, or games in the monthly plan.',
      );
      return;
    }

    if (errors.length > 0) {
      return;
    }

    const existingIds = compact(poolGames.map((game) => game.id));
    const existingPool =
      existingIds.length === poolGames.length
        ? await this.findPoolWithGameIds(this.dataSource.manager, existingIds)
        : null;

    actions.push(
      existingPool
        ? {
            type: 'reuse',
            entity: 'pool',
            label: `Pool #${existingPool.id}`,
            details: { games: poolGames.map((game) => game.title) },
          }
        : {
            type: 'create',
            entity: 'pool',
            label: poolGames.map((game) => game.title).join(', '),
          },
    );

    if (plan.pool.attachToCampaign !== false) {
      actions.push({
        type: 'update',
        entity: 'campaign',
        label: 'attach pool',
      });
    }
  }

  private async previewParticipants(
    plan: MonthlyPlanDto,
    actions: PreviewAction[],
    warnings: string[],
    errors: string[],
  ): Promise<void> {
    const campaign = await this.resolveCampaignForPreview(plan.campaign);

    for (const participant of plan.participants ?? []) {
      const suggestedGame = await this.resolveSuggestedGameForPreview(
        participant,
        plan.games ?? [],
        errors,
      );
      const providedDetails = this.getProvidedParticipantDetails(
        participant,
        suggestedGame,
      );
      const player = await this.resolvePlayerForPreview(
        participant.player,
        warnings,
        errors,
      );
      const label = this.describePlayerRef(participant.player, player);

      if (!player) {
        if (participant.player.createIfMissing) {
          actions.push({ type: 'create', entity: 'player', label });
          actions.push({
            type: 'create',
            entity: 'campaign_player',
            label,
            details: providedDetails,
          });
        }
        continue;
      }

      if (!campaign) {
        actions.push({
          type: 'update',
          entity: 'campaign_player',
          label,
          details: providedDetails,
        });
        continue;
      }

      const campaignPlayer = await this.campaignPlayerRepository.findOne({
        where: {
          campaign: { id: campaign.id },
          player: { id: player.id },
        },
        relations: ['suggestedGame'],
      });

      if (!campaignPlayer) {
        actions.push({
          type: 'create',
          entity: 'campaign_player',
          label,
          details: providedDetails,
        });
        continue;
      }

      const changes = this.describeParticipantChanges(
        campaignPlayer,
        participant,
        suggestedGame,
      );

      actions.push(
        Object.keys(changes).length > 0
          ? {
              type: 'update',
              entity: 'campaign_player',
              label,
              details: changes,
            }
          : {
              type: 'skip',
              entity: 'campaign_player',
              label,
              details: { reason: 'already up to date' },
            },
      );
    }
  }

  private async previewRecommendations(
    plan: MonthlyPlanDto,
    actions: PreviewAction[],
    warnings: string[],
    errors: string[],
  ): Promise<void> {
    for (const recommendation of plan.recommendations ?? []) {
      const game = await this.resolveRecommendationGameForPreview(
        recommendation,
        plan.games ?? [],
        errors,
      );
      const player = await this.resolvePlayerForPreview(
        recommendation.player,
        warnings,
        errors,
      );

      if (!game || !player) {
        continue;
      }

      const label = `${game.title} — ${this.describePlayerRef(
        recommendation.player,
        player,
      )}`;
      const existing = game.id
        ? await this.gameRecommendationRepository.findOne({
            where: {
              game: { id: game.id },
              player: { id: player.id },
            },
          })
        : null;

      actions.push(
        existing
          ? {
              type: 'skip',
              entity: 'game_recommendation',
              label,
              details: { reason: 'already recorded' },
            }
          : {
              type: 'create',
              entity: 'game_recommendation',
              label,
            },
      );
    }
  }

  private async upsertGamesInTransaction(
    manager: EntityManager,
    games: AdminGameInputDto[],
  ): Promise<Map<string, Game>> {
    const savedGames = new Map<string, Game>();

    for (const input of games) {
      if (!input.id && !input.title?.trim()) {
        throw new BadRequestException(
          'Every game must have either id or title.',
        );
      }

      const gameRepository = manager.getRepository(Game);
      const existingGame = await this.findGameByInput(manager, input);
      const game = existingGame ?? gameRepository.create();

      if (input.title?.trim()) {
        game.title = input.title.trim();
      } else if (!existingGame) {
        throw new BadRequestException('Cannot create a game without a title.');
      }

      if (input.cover !== undefined) {
        game.cover = input.cover ?? null;
      }

      if (input.suggestion !== undefined) {
        game.suggestion = input.suggestion ?? false;
      }

      if (input.steam !== undefined) {
        game.steam = input.steam ?? null;
      }

      if (input.trailer !== undefined) {
        game.trailer = input.trailer ?? null;
      }

      if (input.summary !== undefined) {
        game.summary = input.summary ?? null;
      }

      if (input.howLongToBeatUrl !== undefined) {
        game.howLongToBeatUrl = input.howLongToBeatUrl ?? null;
      }

      if (input.durationLabel !== undefined) {
        game.durationLabel = input.durationLabel ?? null;
      }

      const savedGame = await gameRepository.save(game);
      savedGames.set(normalizeText(savedGame.title), savedGame);
    }

    return savedGames;
  }

  private async resolveOrCreateCampaign(
    manager: EntityManager,
    input?: AdminCampaignInputDto,
  ): Promise<Campaign> {
    if (input?.id) {
      return this.findCampaignOrFail(manager, input.id);
    }

    const currentCampaign = await this.findCurrentCampaign(manager);

    if (currentCampaign && input?.useCurrent !== false) {
      return currentCampaign;
    }

    if (!input?.month || !input?.year) {
      throw new BadRequestException(
        'No current campaign found. Provide campaign.month and campaign.year to create one.',
      );
    }

    return manager.getRepository(Campaign).create({
      month: input.month,
      year: input.year,
      description: input.description,
      meetingAt: input.meetingAt,
      meetingLocation: input.meetingLocation,
      meetingUrl: input.meetingUrl,
      current: input.current ?? input.setCurrent ?? true,
      electionActive: input.electionActive ?? false,
      players: [],
    });
  }

  private async applyCampaignFields(
    manager: EntityManager,
    campaign: Campaign,
    input: AdminCampaignInputDto | undefined,
    savedGames: Map<string, Game>,
  ): Promise<void> {
    if (!input) {
      return;
    }

    if (input.month) {
      campaign.month = input.month;
    }

    if (input.year) {
      campaign.year = input.year;
    }

    if (input.description !== undefined) {
      campaign.description = input.description ?? null;
    }

    if (input.meetingAt !== undefined) {
      campaign.meetingAt = input.meetingAt ?? null;
    }

    if (input.meetingLocation !== undefined) {
      campaign.meetingLocation = input.meetingLocation ?? null;
    }

    if (input.meetingUrl !== undefined) {
      campaign.meetingUrl = input.meetingUrl ?? null;
    }

    if (input.electionActive !== undefined) {
      campaign.electionActive = input.electionActive ?? false;
    }

    if (input.gameId) {
      campaign.game = await manager.getRepository(Game).findOneByOrFail({
        id: input.gameId,
      });
    } else if (input.gameTitle) {
      const savedGame = savedGames.get(normalizeText(input.gameTitle));
      const game =
        savedGame ?? (await this.findGameByTitle(manager, input.gameTitle));

      if (!game) {
        throw new BadRequestException(
          `Could not find game '${input.gameTitle}' for campaign.`,
        );
      }

      campaign.game = game;
    }

    if (input.poolId) {
      campaign.pool = await this.findPoolOrFail(manager, input.poolId);
    }
  }

  private async saveCampaignWithCurrentHandling(
    manager: EntityManager,
    campaign: Campaign,
    input?: AdminCampaignInputDto,
  ): Promise<Campaign> {
    const shouldSetCurrent =
      input?.current === true || input?.setCurrent === true;

    if (shouldSetCurrent || (!campaign.id && campaign.current)) {
      await manager
        .createQueryBuilder()
        .update(Campaign)
        .set({ current: false })
        .where('current = :current', { current: true })
        .execute();
      campaign.current = true;
    }

    return manager.getRepository(Campaign).save(campaign);
  }

  private async resolveOrCreatePool(
    manager: EntityManager,
    input: AdminPoolInputDto,
    planGames: AdminGameInputDto[],
    savedGames: Map<string, Game>,
  ): Promise<Pool> {
    const games = await this.resolvePoolGames(
      manager,
      input,
      planGames,
      savedGames,
    );

    if (games.length === 0) {
      throw new BadRequestException(
        'Pool needs gameIds, gameTitles, or games in the monthly plan.',
      );
    }

    const existingPool = await this.findPoolWithGameIds(
      manager,
      games.map((game) => game.id),
    );

    if (existingPool) {
      return existingPool;
    }

    const poolOptionRepository = manager.getRepository(PoolOption);
    const pool = manager.getRepository(Pool).create();
    pool.options = games.map((game) =>
      poolOptionRepository.create({ game, players: [] }),
    );

    return manager.getRepository(Pool).save(pool);
  }

  private async resolvePoolGames(
    manager: EntityManager,
    input: AdminPoolInputDto,
    planGames: AdminGameInputDto[],
    savedGames: Map<string, Game>,
  ): Promise<Game[]> {
    const games: Game[] = [];
    const gameRepository = manager.getRepository(Game);

    for (const gameId of input.gameIds ?? []) {
      const game = await gameRepository.findOneBy({ id: gameId });

      if (!game) {
        throw new BadRequestException(`Could not find game #${gameId}.`);
      }

      games.push(game);
    }

    for (const gameTitle of this.getPoolGameTitles(input, planGames)) {
      const savedGame = savedGames.get(normalizeText(gameTitle));
      const game =
        savedGame ?? (await this.findGameByTitle(manager, gameTitle));

      if (!game) {
        throw new BadRequestException(`Could not find game '${gameTitle}'.`);
      }

      games.push(game);
    }

    const seenIds = new Set<number>();
    return games.filter((game) => {
      if (seenIds.has(game.id)) {
        return false;
      }

      seenIds.add(game.id);
      return true;
    });
  }

  private async resolvePoolGamesForPreview(
    input: AdminPoolInputDto,
    planGames: AdminGameInputDto[],
    warnings: string[],
    errors: string[],
  ): Promise<Array<Pick<Game, 'id' | 'title'>>> {
    const games: Array<Pick<Game, 'id' | 'title'>> = [];
    const plannedGameTitles = new Set(
      compact(planGames.map((game) => game.title)).map((title) =>
        normalizeText(title),
      ),
    );

    for (const gameId of input.gameIds ?? []) {
      const game = await this.gameRepository.findOneBy({ id: gameId });

      if (!game) {
        errors.push(`Could not find game #${gameId}.`);
      } else {
        games.push(game);
      }
    }

    for (const gameTitle of this.getPoolGameTitles(input, planGames)) {
      const game = await this.findGameByTitle(
        this.dataSource.manager,
        gameTitle,
      );

      if (game) {
        games.push(game);
      } else if (plannedGameTitles.has(normalizeText(gameTitle))) {
        games.push({ id: undefined as unknown as number, title: gameTitle });
      } else {
        errors.push(`Could not find game '${gameTitle}'.`);
      }
    }

    const seenTitles = new Set<string>();
    return games.filter((game) => {
      const normalizedTitle = normalizeText(game.title);

      if (seenTitles.has(normalizedTitle)) {
        warnings.push(`Duplicate pool option ignored: ${game.title}`);
        return false;
      }

      seenTitles.add(normalizedTitle);
      return true;
    });
  }

  private getPoolGameTitles(
    input: AdminPoolInputDto,
    planGames: AdminGameInputDto[],
  ): string[] {
    if ((input.gameTitles?.length ?? 0) > 0) {
      return input.gameTitles ?? [];
    }

    if ((input.gameIds?.length ?? 0) > 0) {
      return [];
    }

    return compact(planGames.map((game) => game.title));
  }

  private async resolveSuggestedGameForPreview(
    participant: AdminParticipantInputDto,
    planGames: AdminGameInputDto[],
    errors: string[],
  ): Promise<SuggestedGameReference | undefined> {
    try {
      this.validateSuggestedGameInput(participant);
    } catch (error: unknown) {
      errors.push(
        error instanceof Error ? error.message : 'Invalid suggested game.',
      );
      return undefined;
    }

    if (participant.suggestedGameId) {
      const game = await this.gameRepository.findOneBy({
        id: participant.suggestedGameId,
      });

      if (!game) {
        errors.push(
          `Could not find suggested game #${participant.suggestedGameId}.`,
        );
        return undefined;
      }

      return game;
    }

    if (!participant.suggestedGameTitle) {
      return undefined;
    }

    const existingGame = await this.findGameByTitle(
      this.dataSource.manager,
      participant.suggestedGameTitle,
    );

    if (existingGame) {
      return existingGame;
    }

    const plannedGame = planGames.find(
      (game) =>
        game.title &&
        normalizeText(game.title) ===
          normalizeText(participant.suggestedGameTitle ?? ''),
    );

    if (plannedGame?.title) {
      return { id: plannedGame.id, title: plannedGame.title };
    }

    errors.push(
      `Could not find suggested game '${participant.suggestedGameTitle}'.`,
    );
    return undefined;
  }

  private async resolveRecommendationGameForPreview(
    recommendation: AdminGameRecommendationInputDto,
    planGames: AdminGameInputDto[],
    errors: string[],
  ): Promise<SuggestedGameReference | undefined> {
    const hasGameId = recommendation.gameId !== undefined;
    const hasGameTitle = recommendation.gameTitle !== undefined;

    if (hasGameId === hasGameTitle) {
      errors.push(
        'Every recommendation must provide exactly one of gameId or gameTitle.',
      );
      return undefined;
    }

    if (recommendation.gameId) {
      const game = await this.gameRepository.findOneBy({
        id: recommendation.gameId,
      });

      if (!game) {
        errors.push(
          `Could not find recommended game #${recommendation.gameId}.`,
        );
      }

      return game ?? undefined;
    }

    const title = recommendation.gameTitle ?? '';
    const existingGame = await this.findGameByTitle(
      this.dataSource.manager,
      title,
    );

    if (existingGame) {
      return existingGame;
    }

    const plannedGame = planGames.find(
      (game) =>
        game.title && normalizeText(game.title) === normalizeText(title),
    );

    if (plannedGame?.title) {
      return { id: plannedGame.id, title: plannedGame.title };
    }

    errors.push(`Could not find recommended game '${title}'.`);
    return undefined;
  }

  private async applyParticipants(
    manager: EntityManager,
    campaign: Campaign,
    participants: AdminParticipantInputDto[],
    savedGames: Map<string, Game> = new Map(),
  ): Promise<void> {
    const campaignPlayerRepository = manager.getRepository(CampaignPlayer);

    for (const participant of participants) {
      const player = await this.resolvePlayer(manager, participant.player);
      const suggestedGame = await this.resolveSuggestedGame(
        manager,
        participant,
        savedGames,
      );

      let campaignPlayer = await campaignPlayerRepository.findOne({
        where: {
          campaign: { id: campaign.id },
          player: { id: player.id },
        },
        relations: ['suggestedGame'],
      });

      if (!campaignPlayer) {
        campaignPlayer = campaignPlayerRepository.create({
          campaign,
          player,
          played_the_game: false,
          finished_the_game: false,
          partook_in_the_meeting: false,
          suggested_a_game: false,
          suggestedGame: null,
        });
      }

      for (const flag of participantFlags) {
        if (participant[flag] !== undefined) {
          campaignPlayer[flag] = participant[flag] ?? false;
        }
      }

      if (suggestedGame) {
        campaignPlayer.suggestedGame = suggestedGame;
        campaignPlayer.suggested_a_game = true;
        await this.ensureGameRecommendation(manager, suggestedGame, player);
      } else if (participant.suggested_a_game === false) {
        campaignPlayer.suggestedGame = null;
      }

      await campaignPlayerRepository.save(campaignPlayer);
    }
  }

  private async applyRecommendations(
    manager: EntityManager,
    recommendations: AdminGameRecommendationInputDto[],
    savedGames: Map<string, Game>,
  ): Promise<void> {
    for (const recommendation of recommendations) {
      const player = await this.resolvePlayer(manager, recommendation.player);
      const game = await this.resolveRecommendationGame(
        manager,
        recommendation,
        savedGames,
      );
      await this.ensureGameRecommendation(manager, game, player);
    }
  }

  private async ensureGameRecommendation(
    manager: EntityManager,
    game: Game,
    player: Player,
  ): Promise<void> {
    const repository = manager.getRepository(GameRecommendation);
    const existing = await repository.findOne({
      where: { game: { id: game.id }, player: { id: player.id } },
    });

    if (!existing) {
      await repository.save(repository.create({ game, player }));
    }
  }

  private async resolveSuggestedGame(
    manager: EntityManager,
    participant: AdminParticipantInputDto,
    savedGames: Map<string, Game>,
  ): Promise<Game | undefined> {
    this.validateSuggestedGameInput(participant);

    if (participant.suggestedGameId) {
      const game = await manager.getRepository(Game).findOneBy({
        id: participant.suggestedGameId,
      });

      if (!game) {
        throw new BadRequestException(
          `Could not find suggested game #${participant.suggestedGameId}.`,
        );
      }

      return game;
    }

    if (participant.suggestedGameTitle) {
      const game =
        savedGames.get(normalizeText(participant.suggestedGameTitle)) ??
        (await this.findGameByTitle(manager, participant.suggestedGameTitle));

      if (!game) {
        throw new BadRequestException(
          `Could not find suggested game '${participant.suggestedGameTitle}'.`,
        );
      }

      return game;
    }

    return undefined;
  }

  private async resolveRecommendationGame(
    manager: EntityManager,
    recommendation: AdminGameRecommendationInputDto,
    savedGames: Map<string, Game>,
  ): Promise<Game> {
    const hasGameId = recommendation.gameId !== undefined;
    const hasGameTitle = recommendation.gameTitle !== undefined;

    if (hasGameId === hasGameTitle) {
      throw new BadRequestException(
        'Every recommendation must provide exactly one of gameId or gameTitle.',
      );
    }

    const game = recommendation.gameId
      ? await manager
          .getRepository(Game)
          .findOneBy({ id: recommendation.gameId })
      : (savedGames.get(normalizeText(recommendation.gameTitle ?? '')) ??
        (await this.findGameByTitle(manager, recommendation.gameTitle ?? '')));

    if (!game) {
      throw new BadRequestException(
        recommendation.gameId
          ? `Could not find recommended game #${recommendation.gameId}.`
          : `Could not find recommended game '${recommendation.gameTitle}'.`,
      );
    }

    return game;
  }

  private validateSuggestedGameInput(
    participant: AdminParticipantInputDto,
  ): void {
    const hasGameId = participant.suggestedGameId !== undefined;
    const hasGameTitle = participant.suggestedGameTitle !== undefined;

    if (hasGameId && hasGameTitle) {
      throw new BadRequestException(
        'Provide either suggestedGameId or suggestedGameTitle, not both.',
      );
    }

    if ((hasGameId || hasGameTitle) && participant.suggested_a_game === false) {
      throw new BadRequestException(
        'A suggested game cannot be attached when suggested_a_game is false.',
      );
    }
  }

  private async resolvePlayer(
    manager: EntityManager,
    playerRef: AdminPlayerReferenceDto,
  ): Promise<Player> {
    const player = await this.findPlayerByReference(manager, playerRef);

    if (player) {
      return player;
    }

    if (!playerRef.createIfMissing) {
      throw new BadRequestException(
        `Could not resolve player '${this.describePlayerRef(playerRef)}'.`,
      );
    }

    const playerRepository = manager.getRepository(Player);
    return playerRepository.save(
      playerRepository.create({
        email: playerRef.email,
        name: playerRef.name ?? playerRef.email ?? playerRef.discordUsername,
        discord:
          playerRef.discordId || playerRef.discordUsername
            ? {
                id: playerRef.discordId,
                username: playerRef.discordUsername,
              }
            : undefined,
      }),
    );
  }

  private async resolvePlayerForPreview(
    playerRef: AdminPlayerReferenceDto,
    warnings: string[],
    errors: string[],
  ): Promise<Player | null> {
    const players = await this.findPlayersByReference(
      this.dataSource.manager,
      playerRef,
    );

    if (players.length === 1) {
      return players[0];
    }

    if (players.length > 1) {
      errors.push(
        `Ambiguous player '${this.describePlayerRef(playerRef)}': ${players
          .map(
            (player) =>
              `${player.name ?? player.email ?? player.id} (#${player.id})`,
          )
          .join(', ')}`,
      );
      return null;
    }

    if (!playerRef.createIfMissing) {
      errors.push(
        `Could not resolve player '${this.describePlayerRef(playerRef)}'.`,
      );
    } else if (
      !playerRef.email &&
      !playerRef.name &&
      !playerRef.discordUsername
    ) {
      warnings.push(
        `Player '${this.describePlayerRef(playerRef)}' will be created with very little identifying information.`,
      );
    }

    return null;
  }

  private async findPlayerByReference(
    manager: EntityManager,
    playerRef: AdminPlayerReferenceDto,
  ): Promise<Player | null> {
    const players = await this.findPlayersByReference(manager, playerRef);

    if (players.length > 1) {
      throw new BadRequestException(
        `Ambiguous player '${this.describePlayerRef(playerRef)}'. Use playerId instead.`,
      );
    }

    return players[0] ?? null;
  }

  private async findPlayersByReference(
    manager: EntityManager,
    playerRef: AdminPlayerReferenceDto,
  ): Promise<Player[]> {
    const playerRepository = manager.getRepository(Player);

    if (playerRef.playerId) {
      const player = await playerRepository.findOneBy({
        id: playerRef.playerId,
      });
      return player ? [player] : [];
    }

    const players = await playerRepository.find();

    if (playerRef.email) {
      return players.filter((player) => player.email === playerRef.email);
    }

    if (playerRef.discordId) {
      return players.filter(
        (player) => player.discord?.id === playerRef.discordId,
      );
    }

    const name = playerRef.name ?? playerRef.discordUsername;

    if (!name) {
      return [];
    }

    const normalizedName = normalizeText(name);
    return players.filter((player) =>
      [player.name, player.discord?.username, player.discord?.globalName].some(
        (value) => (value ? normalizeText(value) === normalizedName : false),
      ),
    );
  }

  private calculateElectionResult(campaign: Campaign): ElectionResultOption[] {
    if (!campaign.pool) {
      throw new BadRequestException('Campaign has no pool');
    }

    return campaign.pool.options.map((option) => {
      const tokens = option.players.reduce((total, player) => {
        const campaignPlayer = campaign.players.find(
          (entry) => entry.player.id === player.id,
        );

        return total + (campaignPlayer?.tokens ?? 0);
      }, 0);

      return {
        optionId: option.id,
        gameId: option.game.id,
        game: option.game.title,
        tokens,
        voters: option.players.map(
          (player) => player.name ?? player.email ?? `Player #${player.id}`,
        ),
      };
    });
  }

  private async findCurrentCampaign(
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Campaign | null> {
    return manager.getRepository(Campaign).findOne({
      where: { current: true },
      relations: campaignRelations,
    });
  }

  private async findCurrentCampaignOrFail(
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Campaign> {
    const campaign = await this.findCurrentCampaign(manager);

    if (!campaign) {
      throw new NotFoundException('No current campaign found');
    }

    return campaign;
  }

  private async findCampaignOrFail(
    manager: EntityManager,
    id: number,
  ): Promise<Campaign> {
    const campaign = await manager.getRepository(Campaign).findOne({
      where: { id },
      relations: campaignRelations,
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign #${id} not found`);
    }

    return campaign;
  }

  private async findPoolOrFail(
    manager: EntityManager,
    id: number,
  ): Promise<Pool> {
    const pool = await manager.getRepository(Pool).findOne({
      where: { id },
      relations: poolRelations,
    });

    if (!pool) {
      throw new NotFoundException(`Pool #${id} not found`);
    }

    return pool;
  }

  private async resolveCampaignForPreview(
    input?: AdminCampaignInputDto,
  ): Promise<Campaign | null> {
    if (input?.id) {
      return this.campaignRepository.findOne({
        where: { id: input.id },
        relations: campaignRelations,
      });
    }

    if (input?.useCurrent === false && input.month && input.year) {
      return null;
    }

    return this.findCurrentCampaign();
  }

  private async findGameByInput(
    manager: EntityManager,
    input: AdminGameInputDto,
  ): Promise<Game | null> {
    if (input.id) {
      return manager.getRepository(Game).findOneBy({ id: input.id });
    }

    if (!input.title) {
      return null;
    }

    return this.findGameByTitle(manager, input.title);
  }

  private async findGameByTitle(
    manager: EntityManager,
    title: string,
  ): Promise<Game | null> {
    const games = await manager.getRepository(Game).find();
    const normalizedTitle = normalizeText(title);

    return (
      games.find((game) => normalizeText(game.title) === normalizedTitle) ??
      null
    );
  }

  private async findPoolWithGameIds(
    manager: EntityManager,
    gameIds: number[],
  ): Promise<Pool | null> {
    const desiredGameIds = sortedUniqueNumbers(gameIds);

    if (desiredGameIds.length === 0) {
      return null;
    }

    const pools = await manager.getRepository(Pool).find({
      relations: poolRelations,
    });

    return (
      pools.find((pool) => {
        const poolGameIds = sortedUniqueNumbers(
          pool.options.map((option) => option.game.id),
        );

        return (
          poolGameIds.length === desiredGameIds.length &&
          poolGameIds.every((gameId, index) => gameId === desiredGameIds[index])
        );
      }) ?? null
    );
  }

  private describeGameChanges(
    existingGame: Game,
    input: AdminGameInputDto,
  ): Record<string, unknown> {
    const changes: Record<string, unknown> = {};

    if (input.title && input.title.trim() !== existingGame.title) {
      changes.title = { from: existingGame.title, to: input.title.trim() };
    }

    if (input.cover !== undefined && input.cover !== existingGame.cover) {
      changes.cover = { from: existingGame.cover ?? null, to: input.cover };
    }

    if (
      input.suggestion !== undefined &&
      input.suggestion !== existingGame.suggestion
    ) {
      changes.suggestion = {
        from: existingGame.suggestion,
        to: input.suggestion,
      };
    }

    if (input.steam !== undefined && input.steam !== existingGame.steam) {
      changes.steam = { from: existingGame.steam ?? null, to: input.steam };
    }

    if (input.trailer !== undefined && input.trailer !== existingGame.trailer) {
      changes.trailer = {
        from: existingGame.trailer ?? null,
        to: input.trailer,
      };
    }

    if (input.summary !== undefined && input.summary !== existingGame.summary) {
      changes.summary = {
        from: existingGame.summary ?? null,
        to: input.summary,
      };
    }

    if (
      input.howLongToBeatUrl !== undefined &&
      input.howLongToBeatUrl !== existingGame.howLongToBeatUrl
    ) {
      changes.howLongToBeatUrl = {
        from: existingGame.howLongToBeatUrl ?? null,
        to: input.howLongToBeatUrl,
      };
    }

    if (
      input.durationLabel !== undefined &&
      input.durationLabel !== existingGame.durationLabel
    ) {
      changes.durationLabel = {
        from: existingGame.durationLabel ?? null,
        to: input.durationLabel,
      };
    }

    return changes;
  }

  private describeParticipantChanges(
    campaignPlayer: CampaignPlayer,
    participant: AdminParticipantInputDto,
    suggestedGame?: SuggestedGameReference,
  ): Record<string, unknown> {
    const changes: Record<string, unknown> = {};

    for (const flag of participantFlags) {
      const targetValue =
        flag === 'suggested_a_game' && suggestedGame ? true : participant[flag];

      if (targetValue !== undefined && targetValue !== campaignPlayer[flag]) {
        changes[flag] = {
          from: campaignPlayer[flag],
          to: targetValue,
        };
      }
    }

    if (suggestedGame) {
      const currentGame = campaignPlayer.suggestedGame;
      const isSameGame = suggestedGame.id
        ? currentGame?.id === suggestedGame.id
        : currentGame
          ? normalizeText(currentGame.title) ===
            normalizeText(suggestedGame.title)
          : false;

      if (!isSameGame) {
        changes.suggestedGame = {
          from: currentGame
            ? { id: currentGame.id, title: currentGame.title }
            : null,
          to: suggestedGame,
        };
      }
    } else if (
      participant.suggested_a_game === false &&
      campaignPlayer.suggestedGame
    ) {
      changes.suggestedGame = {
        from: {
          id: campaignPlayer.suggestedGame.id,
          title: campaignPlayer.suggestedGame.title,
        },
        to: null,
      };
    }

    return changes;
  }

  private getProvidedParticipantDetails(
    participant: AdminParticipantInputDto,
    suggestedGame?: SuggestedGameReference,
  ): Record<string, unknown> {
    const details: Record<string, unknown> = {};

    for (const flag of participantFlags) {
      if (participant[flag] !== undefined) {
        details[flag] = participant[flag] ?? false;
      }
    }

    if (suggestedGame) {
      details.suggested_a_game = true;
      details.suggestedGame = suggestedGame;
    }

    return details;
  }

  private describePlayerRef(
    playerRef: AdminPlayerReferenceDto,
    player?: Player | null,
  ): string {
    if (player) {
      return `${player.name ?? player.email ?? player.discord?.username ?? 'Player'} (#${player.id})`;
    }

    return (
      playerRef.name ??
      playerRef.email ??
      playerRef.discordUsername ??
      playerRef.discordId ??
      (playerRef.playerId ? `#${playerRef.playerId}` : 'unknown player')
    );
  }

  private buildConfirmationToken(plan: MonthlyPlanDto): string {
    const secret =
      this.config.get<string>('MCP_ADMIN_TOKEN') ??
      this.config.get<string>('ADMIN_API_TOKEN') ??
      'missing-admin-token';

    return createHash('sha256')
      .update(stableStringify(plan))
      .update(secret)
      .digest('hex');
  }

  private safeTokenEquals(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    return (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }

  private extractMonthlyPlan(dto: ApplyMonthlyPlanDto): MonthlyPlanDto {
    return {
      campaign: dto.campaign,
      games: dto.games,
      pool: dto.pool,
      participants: dto.participants,
      recommendations: dto.recommendations,
    };
  }

  private async writeAuditLog(
    manager: EntityManager,
    action: string,
    payload: Record<string, unknown> | object,
    result: Record<string, unknown>,
  ): Promise<void> {
    const auditRepository = manager.getRepository(AdminAuditLog);

    await auditRepository.save(
      auditRepository.create({
        action,
        actor: 'mcp',
        payload: payload as Record<string, unknown>,
        result,
      }),
    );
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { Game } from '../games/entities/game.entity';
import { GameResearchService } from '../games/game-research.service';
import {
  TARGET_POOL_SIZE,
  findEligibleBacklogGames,
  findGuaranteedNextVoteGames,
  normalizeGameIdentity,
} from '../games/games.service';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import {
  ApplyCycleTransitionDto,
  PreviewCycleTransitionDto,
  StartElectionDto,
} from './dto/cycle-transition.dto';
import {
  DiscordCyclePreview,
  DiscordCycleService,
} from './discord-cycle.service';

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
const PORTUGUESE_MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

interface DrawTokenPayload {
  kind: 'cycle-draw';
  campaignId: number;
  gameIds: number[];
  guaranteedGameIds: number[];
  expiresAt: number;
}

interface TransitionTokenPayload {
  kind: 'cycle-transition';
  campaignId: number;
  winnerGameId: number;
  voteFingerprint: string;
  inputFingerprint: string;
  discordFingerprint: string;
  expiresAt: number;
}

export interface ElectionResultOption {
  optionId: number;
  gameId: number;
  game: string;
  tokens: number;
  voters: string[];
}

export interface CycleTransitionPreview {
  valid: boolean;
  errors: string[];
  warnings: string[];
  confirmationToken: string | null;
  electionResult: ElectionResultOption[];
  winner: Game | null;
  campaign: {
    month: string;
    year: string;
    description: string;
    meetingAt: string | null;
    meetingLocation: string | null;
  } | null;
  discord: DiscordCyclePreview | null;
}

@Injectable()
export class CycleService {
  private readonly signingSecret: string;

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    private readonly dataSource: DataSource,
    config: ConfigService,
    private readonly discord: DiscordCycleService,
    private readonly gameResearch: GameResearchService,
  ) {
    this.signingSecret =
      config.get<string>('CYCLE_AUTOMATION_SECRET')?.trim() ||
      config.getOrThrow<string>('JWT_SECRET');
  }

  async getOverview(): Promise<Record<string, unknown>> {
    const campaign = await this.findCurrentCampaignOrFail();
    if (
      campaign.electionActive &&
      campaign.electionEndsAt &&
      new Date(campaign.electionEndsAt).getTime() <= Date.now()
    ) {
      campaign.electionActive = false;
      campaign.electionClosedAt = new Date().toISOString();
      await this.campaignRepository.update(campaign.id, {
        electionActive: false,
        electionClosedAt: campaign.electionClosedAt,
      });
    }
    const guaranteedGames = await findGuaranteedNextVoteGames(
      this.dataSource.manager,
    );

    return {
      campaign,
      guaranteedGames,
      electionResult: campaign.pool
        ? this.calculateElectionResult(campaign)
        : [],
      targetPoolSize: TARGET_POOL_SIZE,
      nextCampaign: this.getNextCampaignDefaults(campaign),
      discordConfigured: this.discord.isConfigured(),
    };
  }

  async drawPool(): Promise<Record<string, unknown>> {
    const campaign = await this.findCurrentCampaignOrFail();

    if (campaign.electionActive) {
      throw new BadRequestException('A votação deste ciclo já está aberta.');
    }

    const guaranteedGames = await findGuaranteedNextVoteGames(
      this.dataSource.manager,
    );
    for (const game of guaranteedGames) {
      await this.refreshResearch(game);
    }
    const invalidGuaranteed = guaranteedGames.filter(
      (game) => !this.isDurationEligible(game),
    );
    if (invalidGuaranteed.length > 0) {
      throw new BadRequestException({
        message:
          'Há sugestões sem uma duração válida no HowLongToBeat. Pesquise-as antes do sorteio.',
        games: invalidGuaranteed.map((game) => ({
          id: game.id,
          title: game.title,
          mainExtraHours: game.mainExtraHours,
        })),
      });
    }

    const guaranteedIdentities = new Set(
      guaranteedGames.map(normalizeGameIdentity),
    );
    const backlogCandidates = await findEligibleBacklogGames(
      this.dataSource.manager,
      guaranteedIdentities,
    );
    const fillCount = Math.max(0, TARGET_POOL_SIZE - guaranteedGames.length);
    const selectedFillers: Game[] = [];
    const rejectedCandidates: Game[] = [];
    const shuffledCandidates = this.shuffle(backlogCandidates);
    for (
      let index = 0;
      index < shuffledCandidates.length && selectedFillers.length < fillCount;
      index += 2
    ) {
      const batch = shuffledCandidates.slice(index, index + 2);
      await Promise.all(batch.map((game) => this.refreshResearch(game)));
      for (const game of batch) {
        if (selectedFillers.length >= fillCount) break;
        if (this.isDurationEligible(game)) {
          selectedFillers.push(game);
        } else {
          rejectedCandidates.push(game);
        }
      }
    }
    const excludedUnverified = rejectedCandidates.filter(
      (game) => !this.hasKnownDuration(game),
    );
    const excludedTooLong = rejectedCandidates.filter(
      (game) => this.hasKnownDuration(game) && !this.isDurationEligible(game),
    );
    const selection = [...guaranteedGames, ...selectedFillers];
    const revealOrder = this.shuffle(selection);
    const warnings: string[] = [];

    if (selectedFillers.length < fillCount) {
      warnings.push(
        `Só há ${selectedFillers.length} jogos elegíveis nas Brasas para ${fillCount} espaços.`,
      );
    }
    if (excludedUnverified.length > 0) {
      warnings.push(
        `${excludedUnverified.length} jogos sorteados ficaram fora porque a duração não pôde ser verificada.`,
      );
    }
    if (excludedTooLong.length > 0) {
      warnings.push(
        `${excludedTooLong.length} jogos sorteados ficaram fora por passarem de 20 horas.`,
      );
    }

    const token = this.signToken<DrawTokenPayload>({
      kind: 'cycle-draw',
      campaignId: campaign.id,
      gameIds: selection.map((game) => game.id),
      guaranteedGameIds: guaranteedGames.map((game) => game.id),
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    return {
      campaignId: campaign.id,
      targetPoolSize: TARGET_POOL_SIZE,
      guaranteedGames,
      selectedFillers,
      revealOrder,
      excludedUnverified,
      excludedTooLong,
      selectionToken: token,
      warnings,
    };
  }

  async startElection(dto: StartElectionDto, actor: Player): Promise<Campaign> {
    const token = this.verifyToken<DrawTokenPayload>(
      dto.selectionToken,
      'cycle-draw',
    );

    if (
      dto.electionEndsAt &&
      new Date(dto.electionEndsAt).getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        'O encerramento da votação precisa estar no futuro.',
      );
    }

    const campaign = await this.dataSource.transaction(async (manager) => {
      const current = await this.findCurrentCampaignOrFail(manager);
      if (current.id !== token.campaignId) {
        throw new BadRequestException(
          'A campanha mudou desde o sorteio. Sorteie novamente.',
        );
      }
      if (current.electionActive) {
        throw new BadRequestException('A votação já está aberta.');
      }

      const guaranteedGames = await findGuaranteedNextVoteGames(manager);
      const guaranteedIds = guaranteedGames.map((game) => game.id).sort();
      if (
        !this.sameNumbers(guaranteedIds, [...token.guaranteedGameIds].sort())
      ) {
        throw new BadRequestException(
          'As sugestões mudaram desde o sorteio. Sorteie novamente.',
        );
      }

      const games = await manager.getRepository(Game).findByIds(token.gameIds);
      if (games.length !== new Set(token.gameIds).size) {
        throw new BadRequestException(
          'Um dos jogos sorteados não está mais disponível.',
        );
      }
      if (games.some((game) => !this.isDurationEligible(game))) {
        throw new BadRequestException(
          'Um dos jogos sorteados perdeu a verificação de duração.',
        );
      }

      const allowedFillers = await findEligibleBacklogGames(
        manager,
        new Set(guaranteedGames.map(normalizeGameIdentity)),
      );
      const allowedIdentities = new Set(
        [
          ...guaranteedGames,
          ...allowedFillers.filter((game) => this.isDurationEligible(game)),
        ].map(normalizeGameIdentity),
      );
      if (
        games.some(
          (game) => !allowedIdentities.has(normalizeGameIdentity(game)),
        )
      ) {
        throw new BadRequestException(
          'Um dos jogos sorteados deixou de ser elegível. Sorteie novamente.',
        );
      }

      const optionRepository = manager.getRepository(PoolOption);
      const pool = manager.getRepository(Pool).create({
        options: token.gameIds.map((gameId) => {
          const game = games.find((candidate) => candidate.id === gameId);
          if (!game) {
            throw new BadRequestException(`Jogo #${gameId} não encontrado.`);
          }
          return optionRepository.create({ game, players: [] });
        }),
      });
      const savedPool = await manager.getRepository(Pool).save(pool);

      current.pool = savedPool;
      current.electionActive = true;
      current.electionStartedAt = new Date().toISOString();
      current.electionEndsAt = dto.electionEndsAt ?? null;
      current.electionClosedAt = null;
      await manager.getRepository(Campaign).save(current);
      await this.writeAudit(
        manager,
        'cycle_election_started',
        actor,
        { electionEndsAt: dto.electionEndsAt ?? null },
        {
          campaignId: current.id,
          poolId: savedPool.id,
          gameIds: token.gameIds,
        },
      );

      return this.findCurrentCampaignOrFail(manager);
    });

    return campaign;
  }

  async previewTransition(
    dto: PreviewCycleTransitionDto,
  ): Promise<CycleTransitionPreview> {
    const campaign = await this.findCurrentCampaignOrFail();
    const errors: string[] = [];
    const warnings: string[] = [];
    const result = campaign.pool ? this.calculateElectionResult(campaign) : [];

    if (!campaign.pool || result.length === 0) {
      errors.push('A campanha atual ainda não tem uma votação para encerrar.');
    }

    if (
      campaign.electionEndsAt &&
      new Date(campaign.electionEndsAt).getTime() > Date.now() &&
      !dto.allowEarlyClose
    ) {
      errors.push(
        `A votação está programada para terminar em ${campaign.electionEndsAt}.`,
      );
    }

    const winningOption = this.resolveWinner(result, dto.winnerGameId, errors);
    const winner = winningOption
      ? await this.gameRepository.findOneBy({ id: winningOption.gameId })
      : null;
    if (winningOption && !winner) {
      errors.push('O jogo vencedor não está mais disponível no catálogo.');
    }
    const duplicateCampaign = await this.findCampaignByMonthAndYear(
      dto.month,
      dto.year,
    );
    if (duplicateCampaign?.id === campaign.id) {
      errors.push('A próxima campanha precisa ter outro mês ou ano.');
    } else if (duplicateCampaign) {
      warnings.push(
        `A campanha ${duplicateCampaign.month} ${duplicateCampaign.year} já existe e será atualizada.`,
      );
    }

    const description = winner
      ? dto.description?.trim() ||
        this.buildCampaignDescription(winner, dto.month, dto.meetingAt)
      : '';
    const discordPreview = winner
      ? await this.discord.preview({
          currentGameTitle: campaign.game?.title ?? null,
          nextGame: winner,
          nextMonth: dto.month.trim(),
          nextYear: dto.year.trim(),
          meetingAt: dto.meetingAt,
          discord: dto.discord,
        })
      : null;
    if (discordPreview) {
      errors.push(...discordPreview.errors);
      warnings.push(...discordPreview.warnings);
    }

    const valid = errors.length === 0 && Boolean(winner);
    const transitionToken =
      valid && winner && discordPreview
        ? this.signToken<TransitionTokenPayload>({
            kind: 'cycle-transition',
            campaignId: campaign.id,
            winnerGameId: winner.id,
            voteFingerprint: this.fingerprint(result),
            inputFingerprint: this.fingerprint(this.transitionInput(dto)),
            discordFingerprint: this.fingerprint(
              this.discordPlanFingerprint(discordPreview),
            ),
            expiresAt: Date.now() + 30 * 60 * 1000,
          })
        : null;

    return {
      valid,
      errors,
      warnings,
      confirmationToken: transitionToken,
      electionResult: result,
      winner,
      campaign: winner
        ? {
            month: dto.month.trim(),
            year: dto.year.trim(),
            description,
            meetingAt: dto.meetingAt ?? null,
            meetingLocation: dto.meetingLocation?.trim() || 'Discord',
          }
        : null,
      discord: discordPreview,
    };
  }

  async applyTransition(
    dto: ApplyCycleTransitionDto,
    actor: Player,
  ): Promise<Record<string, unknown>> {
    if (!dto.confirm) {
      throw new BadRequestException('confirm must be true');
    }

    const preview = await this.previewTransition(dto);
    if (
      !preview.valid ||
      !preview.winner ||
      !preview.campaign ||
      !preview.discord
    ) {
      throw new BadRequestException({
        message: 'A transição ainda contém problemas',
        errors: preview.errors,
      });
    }

    const campaignDraft = preview.campaign;
    const discordPreview = preview.discord;

    const token = this.verifyToken<TransitionTokenPayload>(
      dto.confirmationToken,
      'cycle-transition',
    );
    const current = await this.findCurrentCampaignOrFail();
    const expected = {
      campaignId: current.id,
      winnerGameId: preview.winner.id,
      voteFingerprint: this.fingerprint(preview.electionResult),
      inputFingerprint: this.fingerprint(this.transitionInput(dto)),
      discordFingerprint: this.fingerprint(
        this.discordPlanFingerprint(preview.discord),
      ),
    };
    if (
      token.campaignId !== expected.campaignId ||
      token.winnerGameId !== expected.winnerGameId ||
      token.voteFingerprint !== expected.voteFingerprint ||
      token.inputFingerprint !== expected.inputFingerprint ||
      token.discordFingerprint !== expected.discordFingerprint
    ) {
      throw new BadRequestException(
        'A votação ou o plano mudou desde a prévia. Revise a transição novamente.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const campaignToClose = await this.findCurrentCampaignOrFail(manager);
      if (campaignToClose.id !== token.campaignId) {
        throw new BadRequestException(
          'A campanha atual mudou durante a transição.',
        );
      }
      const freshResult = this.calculateElectionResult(campaignToClose);
      if (this.fingerprint(freshResult) !== token.voteFingerprint) {
        throw new BadRequestException(
          'Os votos mudaram desde a prévia. Revise a transição novamente.',
        );
      }

      campaignToClose.electionActive = false;
      campaignToClose.electionClosedAt ??= new Date().toISOString();
      await manager.getRepository(Campaign).save(campaignToClose);
    });

    const discordResult = await this.discord.apply(
      discordPreview,
      dto.meetingAt,
      campaignDraft.description,
    );

    const nextCampaign = await this.dataSource.transaction(async (manager) => {
      const currentCampaign = await this.findCurrentCampaignOrFail(manager);
      if (currentCampaign.id !== token.campaignId) {
        throw new BadRequestException(
          'A campanha atual mudou durante a transição.',
        );
      }
      const freshResult = this.calculateElectionResult(currentCampaign);
      if (this.fingerprint(freshResult) !== token.voteFingerprint) {
        throw new BadRequestException('Os votos mudaram durante a transição.');
      }

      const game = await manager.getRepository(Game).findOneByOrFail({
        id: token.winnerGameId,
      });
      let next = await this.findCampaignByMonthAndYear(
        dto.month,
        dto.year,
        manager,
      );
      next ??= manager.getRepository(Campaign).create({
        month: dto.month.trim(),
        year: dto.year.trim(),
        players: [],
      });
      next.month = dto.month.trim();
      next.year = dto.year.trim();
      next.game = game;
      next.description = campaignDraft.description;
      next.meetingAt = dto.meetingAt ?? null;
      next.meetingLocation =
        dto.meetingLocation?.trim() ||
        discordPreview.plan.voiceChannel?.name ||
        'Discord';
      next.meetingUrl = discordResult.eventUrl;
      next.pool = null;
      next.electionActive = false;
      next.electionStartedAt = null;
      next.electionEndsAt = null;
      next.electionClosedAt = null;

      currentCampaign.electionActive = false;
      currentCampaign.electionClosedAt ??= new Date().toISOString();
      currentCampaign.current = false;
      await manager.getRepository(Campaign).save(currentCampaign);
      await manager
        .createQueryBuilder()
        .update(Campaign)
        .set({ current: false })
        .where('current = :current', { current: true })
        .execute();
      next.current = true;
      next = await manager.getRepository(Campaign).save(next);

      await this.writeAudit(
        manager,
        'cycle_transition_applied',
        actor,
        this.transitionInput(dto),
        {
          previousCampaignId: currentCampaign.id,
          nextCampaignId: next.id,
          winningGameId: game.id,
          discord: discordResult,
        },
      );

      return manager.getRepository(Campaign).findOneOrFail({
        where: { id: next.id },
        relations: campaignRelations,
      });
    });

    return { campaign: nextCampaign, discord: discordResult };
  }

  private hasKnownDuration(game: Game): boolean {
    return (
      typeof game.mainExtraHours === 'number' &&
      Number.isFinite(game.mainExtraHours)
    );
  }

  private isDurationEligible(game: Game): boolean {
    return (
      this.hasKnownDuration(game) &&
      (game.mainExtraHours ?? Number.POSITIVE_INFINITY) >= 0 &&
      (game.mainExtraHours ?? Number.POSITIVE_INFINITY) <= 20
    );
  }

  private async refreshResearch(game: Game): Promise<void> {
    if (this.hasKnownDuration(game)) return;
    const checkedAt = game.researchCheckedAt
      ? new Date(game.researchCheckedAt).getTime()
      : 0;
    if (checkedAt > Date.now() - 5 * 60 * 1000) return;

    try {
      const assessment = await this.gameResearch.assessCatalogGame(game);
      game.cover ||= assessment.game.cover;
      game.trailer ||= assessment.game.trailer;
      game.summary ||= assessment.game.summary;
      game.howLongToBeatUrl = assessment.game.howLongToBeatUrl;
      game.durationLabel = assessment.game.durationLabel;
      game.mainHours = assessment.game.mainHours;
      game.mainExtraHours = assessment.game.mainExtraHours;
      game.howLongToBeatTitle = assessment.game.howLongToBeatTitle;
      game.researchStatus = assessment.reason;
    } catch {
      game.researchStatus = 'duration_unavailable';
    }
    game.researchCheckedAt = new Date().toISOString();
    await this.gameRepository.save(game);
  }

  private calculateElectionResult(campaign: Campaign): ElectionResultOption[] {
    if (!campaign.pool) return [];
    return campaign.pool.options.map((option) => ({
      optionId: option.id,
      gameId: option.game.id,
      game: option.game.title,
      tokens: option.players.reduce((total, player) => {
        const campaignPlayer = campaign.players.find(
          (entry) => entry.player.id === player.id,
        );
        return total + (campaignPlayer?.tokens ?? 0);
      }, 0),
      voters: option.players.map(
        (player) =>
          player.name ?? player.discord?.globalName ?? `#${player.id}`,
      ),
    }));
  }

  private resolveWinner(
    result: ElectionResultOption[],
    requestedGameId: number | undefined,
    errors: string[],
  ): ElectionResultOption | null {
    if (result.length === 0) return null;
    const highestTokens = Math.max(...result.map((option) => option.tokens));
    const leaders = result.filter((option) => option.tokens === highestTokens);
    const selected = requestedGameId
      ? leaders.find((option) => option.gameId === requestedGameId)
      : leaders.length === 1
        ? leaders[0]
        : null;

    if (!selected) {
      errors.push(
        leaders.length > 1
          ? 'A votação terminou empatada. Escolha explicitamente um dos jogos empatados.'
          : 'O jogo escolhido não lidera a votação.',
      );
      return null;
    }

    return selected;
  }

  private buildCampaignDescription(
    game: Game,
    month: string,
    meetingAt?: string,
  ): string {
    const links = [
      game.steam ? `[Steam](${game.steam})` : null,
      game.trailer ? `[Trailer](${game.trailer})` : null,
      game.howLongToBeatUrl
        ? `[HowLongToBeat](${game.howLongToBeatUrl})${game.durationLabel ? ` ${game.durationLabel}` : ''}`
        : null,
    ].filter(Boolean);
    const meeting = meetingAt
      ? `\n\nO nosso próximo encontro será em ${new Intl.DateTimeFormat(
          'pt-BR',
          {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: 'America/Sao_Paulo',
          },
        ).format(new Date(meetingAt))}.`
      : '';

    return (
      [
        `O jogo do mês de ${month.trim()} é:`,
        `**${game.title}**`,
        game.summary?.trim() ||
          'Uma nova jornada escolhida ao redor da fogueira.',
        links.join(' · '),
      ]
        .filter(Boolean)
        .join('\n\n') + meeting
    );
  }

  private getNextCampaignDefaults(campaign: Campaign): {
    month: string;
    year: string;
  } {
    const normalized = campaign.month
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('pt-BR');
    const currentIndex = PORTUGUESE_MONTHS.findIndex(
      (month) =>
        month
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLocaleLowerCase('pt-BR') === normalized,
    );
    const year = Number(campaign.year);
    if (currentIndex < 0 || !Number.isFinite(year)) {
      const now = new Date();
      return {
        month: PORTUGUESE_MONTHS[(now.getMonth() + 1) % 12],
        year: String(now.getFullYear() + (now.getMonth() === 11 ? 1 : 0)),
      };
    }

    return {
      month: PORTUGUESE_MONTHS[(currentIndex + 1) % 12],
      year: String(year + (currentIndex === 11 ? 1 : 0)),
    };
  }

  private async findCurrentCampaignOrFail(
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Campaign> {
    const campaign = await manager.getRepository(Campaign).findOne({
      where: { current: true },
      relations: campaignRelations,
      lock:
        manager.queryRunner?.isTransactionActive &&
        manager.connection.options.type === 'postgres'
          ? { mode: 'pessimistic_write' }
          : undefined,
    });
    if (!campaign) throw new NotFoundException('No current campaign found');
    return campaign;
  }

  private async findCampaignByMonthAndYear(
    month: string,
    year: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Campaign | null> {
    const campaigns = await manager.getRepository(Campaign).find();
    const normalizedMonth = month.trim().toLocaleLowerCase('pt-BR');
    const normalizedYear = year.trim();
    return (
      campaigns.find(
        (campaign) =>
          campaign.month.trim().toLocaleLowerCase('pt-BR') ===
            normalizedMonth && campaign.year.trim() === normalizedYear,
      ) ?? null
    );
  }

  private transitionInput(dto: PreviewCycleTransitionDto): unknown {
    return {
      winnerGameId: dto.winnerGameId ?? null,
      month: dto.month.trim(),
      year: dto.year.trim(),
      description: dto.description?.trim() ?? null,
      meetingAt: dto.meetingAt ?? null,
      meetingLocation: dto.meetingLocation?.trim() ?? null,
      discord: dto.discord ?? { enabled: true },
      allowEarlyClose: dto.allowEarlyClose ?? false,
    };
  }

  private discordPlanFingerprint(preview: DiscordCyclePreview): unknown {
    return {
      enabled: preview.enabled,
      oldChannelId: preview.plan.oldChannel?.id ?? null,
      discussionCategoryId: preview.plan.discussionCategory?.id ?? null,
      historyCategoryId: preview.plan.historyCategory?.id ?? null,
      createHistoryCategory: preview.plan.createHistoryCategory,
      newChannelName: preview.plan.newChannelName,
      newChannelTopic: preview.plan.newChannelTopic,
      existingNewChannelId: preview.plan.existingNewChannel?.id ?? null,
      voiceChannelId: preview.plan.voiceChannel?.id ?? null,
      eventName: preview.plan.eventName,
      gameCard: preview.plan.gameCard,
    };
  }

  private shuffle<T>(values: T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = randomInt(index + 1);
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  private sameNumbers(left: number[], right: number[]): boolean {
    return (
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }

  private fingerprint(value: unknown): string {
    return createHmac('sha256', this.signingSecret)
      .update(this.stableStringify(value))
      .digest('base64url');
  }

  private signToken<T extends { kind: string; expiresAt: number }>(
    payload: T,
  ): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.signingSecret)
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }

  private verifyToken<T extends { kind: string; expiresAt: number }>(
    token: string,
    expectedKind: string,
  ): T {
    const [encoded, receivedSignature] = token.split('.');
    if (!encoded || !receivedSignature) {
      throw new BadRequestException('Token de confirmação inválido.');
    }
    const expectedSignature = createHmac('sha256', this.signingSecret)
      .update(encoded)
      .digest('base64url');
    const received = Buffer.from(receivedSignature);
    const expected = Buffer.from(expectedSignature);
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new BadRequestException('Token de confirmação inválido.');
    }

    let payload: T;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as T;
    } catch {
      throw new BadRequestException('Token de confirmação inválido.');
    }
    if (payload.kind !== expectedKind || payload.expiresAt < Date.now()) {
      throw new BadRequestException(
        'A prévia expirou. Gere uma nova antes de continuar.',
      );
    }
    return payload;
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object')
      return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`,
      )
      .join(',')}}`;
  }

  private async writeAudit(
    manager: EntityManager,
    action: string,
    actor: Player,
    payload: unknown,
    result: Record<string, unknown>,
  ): Promise<void> {
    const repository = manager.getRepository(AdminAuditLog);
    await repository.save(
      repository.create({
        action,
        actor: `player:${actor.id}`,
        payload: payload as Record<string, unknown>,
        result,
      }),
    );
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import {
  DataSource,
  DeleteResult,
  DeepPartial,
  EntityManager,
  Repository,
} from 'typeorm';
import { CampaignPlayer } from './entities/campaign-player.entity';
import { Player } from '../players/entities/player.entity';
import { UpdateGameInformationDto } from './dto/update-game-information.dto';
import { PoolOption } from '../pool/entities/pool-option.entity';

const normalizeMonth = (month: string): string =>
  month
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');

const MONTH_ORDER = new Map<string, number>(
  [
    ['janeiro', 'january', 'jan'],
    ['fevereiro', 'february', 'feb'],
    ['marco', 'march', 'mar'],
    ['abril', 'april', 'apr'],
    ['maio', 'may'],
    ['junho', 'june', 'jun'],
    ['julho', 'july', 'jul'],
    ['agosto', 'august', 'aug'],
    ['setembro', 'september', 'sep', 'sept'],
    ['outubro', 'october', 'oct'],
    ['novembro', 'november', 'nov'],
    ['dezembro', 'december', 'dec'],
  ].flatMap((aliases, index) => aliases.map((alias) => [alias, index])),
);

const sortCampaigns = (campaigns: Campaign[]): Campaign[] =>
  [...campaigns].sort((a, b) => {
    const yearA = Number(a.year);
    const yearB = Number(b.year);

    if (Number.isFinite(yearA) && Number.isFinite(yearB) && yearA !== yearB) {
      return yearB - yearA;
    }

    if (Number.isFinite(yearA) !== Number.isFinite(yearB)) {
      return Number.isFinite(yearA) ? -1 : 1;
    }

    const monthA = MONTH_ORDER.get(normalizeMonth(a.month));
    const monthB = MONTH_ORDER.get(normalizeMonth(b.month));

    if (monthA !== undefined && monthB !== undefined) {
      return monthB - monthA || b.id - a.id;
    }

    if (monthA !== undefined) return -1;
    if (monthB !== undefined) return 1;

    return a.month.localeCompare(b.month, 'pt-BR') || b.id - a.id;
  });

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignPlayer)
    private campaignPlayerRepository: Repository<CampaignPlayer>,
    private readonly dataSource: DataSource,
  ) {}

  private readonly defaultRelations: string[] = [
    'game',
    'players',
    'players.player',
    'players.suggestedGame',
    'pool',
    'pool.options',
    'pool.options.game',
    'pool.options.players',
  ];

  async create(createCampaignDto: CreateCampaignDto): Promise<Campaign> {
    const { gameId, poolId, ...campaignFields } = createCampaignDto;
    const entity: Campaign = this.campaignRepository.create({
      ...campaignFields,
      game: gameId ? { id: gameId } : undefined,
      pool: poolId ? { id: poolId } : undefined,
    });

    return this.campaignRepository.save(entity);
  }

  findAll(): Promise<Campaign[]> {
    return this.campaignRepository.find({ relations: this.defaultRelations });
  }

  async findAllHistory(): Promise<Campaign[]> {
    const campaigns = await this.campaignRepository.find({
      relations: ['game', 'players', 'players.player', 'players.suggestedGame'],
    });

    return sortCampaigns(campaigns);
  }

  findOne(id: number): Promise<Campaign | null> {
    return this.campaignRepository.findOneBy({ id });
  }

  async findOneOrFail(id: number): Promise<Campaign> {
    const campaign = await this.findOne(id);

    if (!campaign) {
      throw new NotFoundException(`Campaign #${id} not found`);
    }

    return campaign;
  }

  async update(
    id: number,
    updateCampaignDto: UpdateCampaignDto,
  ): Promise<Campaign> {
    const { gameId, poolId, ...campaignFields } = updateCampaignDto;
    const payload: DeepPartial<Campaign> = { id, ...campaignFields };

    if (Object.prototype.hasOwnProperty.call(updateCampaignDto, 'gameId')) {
      payload.game = gameId ? { id: gameId } : null;
    }

    if (Object.prototype.hasOwnProperty.call(updateCampaignDto, 'poolId')) {
      payload.pool = poolId ? { id: poolId } : null;
    }

    const entity: Campaign | undefined =
      await this.campaignRepository.preload(payload);

    if (!entity) {
      throw new NotFoundException(`Campaign #${id} not found`);
    }

    await this.campaignRepository.save(entity);

    return this.campaignRepository.findOneOrFail({
      where: { id },
      relations: this.defaultRelations,
    });
  }

  remove(id: number): Promise<DeleteResult> {
    return this.campaignRepository.delete(id);
  }

  async addPlayer(campaign: Campaign, player: Player): Promise<boolean> {
    if (campaign.players?.some((cp) => cp.player.id === player.id)) {
      return false;
    }

    const campaignPlayer: CampaignPlayer = this.campaignPlayerRepository.create(
      {
        campaign,
        player,
        played_the_game: false,
        finished_the_game: false,
        partook_in_the_meeting: false,
        suggested_a_game: false,
        suggestedGame: null,
      },
    );

    try {
      await this.campaignPlayerRepository.save(campaignPlayer);
    } catch (error: unknown) {
      const existingMembership = await this.campaignPlayerRepository.findOne({
        where: {
          campaign: { id: campaign.id },
          player: { id: player.id },
        },
      });

      if (existingMembership) {
        return false;
      }

      throw error;
    }

    return true;
  }

  async current(player: Player | null = null): Promise<Campaign> {
    const currentCampaign: Campaign =
      await this.campaignRepository.findOneOrFail({
        where: { current: true },
        relations: this.defaultRelations,
      });

    if (!player) {
      return currentCampaign;
    }

    const wasPlayerAdded = await this.addPlayer(currentCampaign, player);

    if (wasPlayerAdded) {
      return this.campaignRepository.findOneOrFail({
        where: { current: true },
        relations: this.defaultRelations,
      });
    }

    return currentCampaign;
  }

  getPlayerCampaign(campaign: Campaign, player: Player): CampaignPlayer | null {
    return campaign.players.find((cp) => cp.player.id === player.id) ?? null;
  }

  async updatePlayerGameInformation(
    player: Player,
    updateGameInformation: UpdateGameInformationDto,
  ): Promise<CampaignPlayer> {
    const currentCampaign: Campaign | null = await this.current();
    const campaignPlayer: CampaignPlayer | null = this.getPlayerCampaign(
      currentCampaign,
      player,
    );

    if (!campaignPlayer) {
      throw new NotFoundException('Player is not part of the current campaign');
    }

    if (
      updateGameInformation.finished_the_game &&
      !updateGameInformation.played_the_game
    ) {
      throw new BadRequestException(
        'A game cannot be finished before it has been started',
      );
    }

    campaignPlayer.played_the_game = updateGameInformation.played_the_game;
    campaignPlayer.finished_the_game = updateGameInformation.finished_the_game;

    return this.campaignPlayerRepository.save(campaignPlayer);
  }

  async undoVote(player: Player): Promise<Campaign> {
    await this.dataSource.transaction(async (manager) => {
      const currentCampaign = await this.findCurrentCampaignOrFail(manager);
      const pool = currentCampaign.pool;

      if (!pool) {
        throw new BadRequestException('Current campaign has no election pool');
      }

      const changedOptions = pool.options.filter((option) => {
        const hadVote = option.players.some((voter) => voter.id === player.id);
        option.players = option.players.filter(
          (voter) => voter.id !== player.id,
        );
        return hadVote;
      });

      if (changedOptions.length > 0) {
        await manager.getRepository(PoolOption).save(changedOptions);
      }
    });

    return this.current();
  }

  async vote(player: Player, optionId: number): Promise<Campaign> {
    await this.dataSource.transaction(async (manager) => {
      const currentCampaign = await this.findCurrentCampaignOrFail(manager);
      const pool = currentCampaign.pool;

      if (!pool) {
        throw new BadRequestException('Current campaign has no election pool');
      }

      const selectedOption = pool.options.find(
        (option) => option.id === optionId,
      );

      if (!selectedOption) {
        throw new BadRequestException(
          `Pool option #${optionId} does not belong to the current campaign`,
        );
      }

      for (const option of pool.options) {
        option.players = option.players.filter(
          (voter) => voter.id !== player.id,
        );
      }

      selectedOption.players.push(player);
      await manager.getRepository(PoolOption).save(pool.options);
    });

    return this.current();
  }

  async recalculateElectionResult(): Promise<
    { optionId: number; game: string; tokens: number }[]
  > {
    const currentCampaign: Campaign = await this.current();

    const pool = currentCampaign.pool;

    if (!pool) {
      throw new BadRequestException('Current campaign has no election pool');
    }

    const electionResult: { optionId: number; game: string; tokens: number }[] =
      [];

    for (const option of pool.options) {
      const players = option.players;

      const tokens = players.reduce((tokens, player) => {
        const campaignPlayer = currentCampaign.players.find(
          (campaignPlayer) => campaignPlayer.player.id === player.id,
        );

        if (!campaignPlayer) {
          return tokens;
        }

        return campaignPlayer.tokens + tokens;
      }, 0);

      electionResult.push({
        optionId: option.id,
        game: option?.game.title,
        tokens,
      });
    }

    return electionResult;
  }

  private async findCurrentCampaignOrFail(
    manager: EntityManager,
  ): Promise<Campaign> {
    const campaign = await manager.getRepository(Campaign).findOne({
      where: { current: true },
      relations: this.defaultRelations,
    });

    if (!campaign) {
      throw new NotFoundException('No current campaign found');
    }

    return campaign;
  }
}

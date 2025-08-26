import { Injectable } from '@nestjs/common';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { DeleteResult, Repository } from 'typeorm';
import { PlayersService } from '../players/players.service';
import { CampaignPlayer } from './entities/campaign-player.entity';
import { Player } from '../players/entities/player.entity';
import { UpdateGameInformationDto } from './dto/update-game-information.dto';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
    @InjectRepository(CampaignPlayer)
    private campaignPlayerRepository: Repository<CampaignPlayer>,
    private playersService: PlayersService,
  ) {}

  async create(createCampaignDto: CreateCampaignDto): Promise<Campaign> {
    const entity: Campaign = this.campaignRepository.create(createCampaignDto);
    return this.campaignRepository.save(entity);
  }

  findAll(): Promise<Campaign[]> {
    return this.campaignRepository.find({
      relations: ['game', 'players', 'players.player'],
    });
  }

  findOne(id: number): Promise<Campaign | null> {
    return this.campaignRepository.findOneBy({ id });
  }

  findOneOrFail(id: number): Promise<Campaign | null> {
    return this.campaignRepository.findOneByOrFail({ id });
  }

  async update(
    id: number,
    updateCampaignDto: UpdateCampaignDto,
  ): Promise<Campaign> {
    const payload: any = { id, ...updateCampaignDto };

    if (Object.prototype.hasOwnProperty.call(updateCampaignDto, 'gameId')) {
      payload.game = updateCampaignDto.gameId
        ? { id: updateCampaignDto.gameId }
        : null;
    }

    const entity: Campaign | undefined =
      await this.campaignRepository.preload(payload);

    if (!entity) {
      throw new Error('Campaign not found');
    }

    await this.campaignRepository.save(entity);

    return this.campaignRepository.findOneOrFail({
      where: { id },
      relations: ['game', 'players', 'players.player'],
    });
  }

  remove(id: number): Promise<DeleteResult> {
    return this.campaignRepository.delete(id);
  }

  async addPlayer(campaign: Campaign, player: Player): Promise<boolean> {
    if (campaign.players.some((cp) => cp.player.id === player.id)) {
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
      },
    );

    await this.campaignPlayerRepository.save(campaignPlayer);

    return true;
  }

  async current(player: Player | null = null): Promise<Campaign> {
    const currentCampaign: Campaign =
      await this.campaignRepository.findOneOrFail({
        where: { current: true },
        relations: ['game', 'players', 'players.player'],
      });

    if (!player) {
      return currentCampaign;
    }

    const wasPlayerAdded = await this.addPlayer(currentCampaign, player);

    if (wasPlayerAdded) {
      return this.campaignRepository.findOneOrFail({
        where: { current: true },
        relations: ['game', 'players', 'players.player'],
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
      throw new Error('Player not in campaign');
    }

    campaignPlayer.played_the_game = updateGameInformation.played_the_game;
    campaignPlayer.finished_the_game = updateGameInformation.finished_the_game;

    return this.campaignPlayerRepository.save(campaignPlayer);
  }
}

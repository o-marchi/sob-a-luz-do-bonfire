import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Game } from '../games/entities/game.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { CampaignService } from './campaign.service';
import { CampaignPlayer } from './entities/campaign-player.entity';
import { Campaign } from './entities/campaign.entity';

describe('CampaignService voting', () => {
  let dataSource: DataSource;
  let service: CampaignService;
  let player: Player;
  let options: PoolOption[];

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      entities: [Campaign, CampaignPlayer, Game, Player, Pool, PoolOption],
      synchronize: true,
    });
    await dataSource.initialize();

    service = new CampaignService(
      dataSource.getRepository(Campaign),
      dataSource.getRepository(CampaignPlayer),
      dataSource,
    );

    const gameRepository = dataSource.getRepository(Game);
    const games = await gameRepository.save([
      gameRepository.create({ title: 'Game A' }),
      gameRepository.create({ title: 'Game B' }),
      gameRepository.create({ title: 'Game C' }),
    ]);

    player = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Player' }));

    const optionRepository = dataSource.getRepository(PoolOption);
    const poolRepository = dataSource.getRepository(Pool);
    const pool = poolRepository.create({
      options: games.slice(0, 2).map((game) =>
        optionRepository.create({
          game,
          players: game.id === games[0].id ? [player] : [],
        }),
      ),
    });
    const savedPool = await poolRepository.save(pool);
    options = savedPool.options;

    const campaignRepository = dataSource.getRepository(Campaign);
    await campaignRepository.save(
      campaignRepository.create({
        month: 'Agosto',
        year: '2026',
        current: true,
        electionActive: true,
        pool: savedPool,
        players: [],
      }),
    );

    const otherPool = poolRepository.create({
      options: [optionRepository.create({ game: games[2], players: [] })],
    });
    await poolRepository.save(otherPool);
    options.push(otherPool.options[0]);
  });

  afterEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('moves a vote between current pool options without duplicates', async () => {
    await service.vote(player, options[1].id);
    await service.vote(player, options[1].id);

    const campaign = await service.current();
    expect(campaign.pool?.options[0].players).toHaveLength(0);
    expect(campaign.pool?.options[1].players.map((voter) => voter.id)).toEqual([
      player.id,
    ]);
  });

  it('rejects an option belonging to another pool without changing the vote', async () => {
    await expect(service.vote(player, options[2].id)).rejects.toThrow(
      BadRequestException,
    );

    const campaign = await service.current();
    expect(campaign.pool?.options[0].players.map((voter) => voter.id)).toEqual([
      player.id,
    ]);
    expect(campaign.pool?.options[1].players).toHaveLength(0);
  });

  it('closes an expired election and rejects late votes', async () => {
    const campaignRepository = dataSource.getRepository(Campaign);
    const campaign = await campaignRepository.findOneByOrFail({
      current: true,
    });
    campaign.electionStartedAt = '2026-08-01T20:00:00-03:00';
    campaign.electionEndsAt = '2026-08-02T20:00:00-03:00';
    await campaignRepository.save(campaign);

    await expect(service.vote(player, options[1].id)).rejects.toThrow(
      'A votação desta campanha está encerrada',
    );

    const current = await service.current();
    expect(current.electionActive).toBe(false);
    expect(current.electionClosedAt).toBeTruthy();
  });

  it('handles concurrent first visits without duplicating campaign membership', async () => {
    await expect(
      Promise.all([service.current(player), service.current(player)]),
    ).resolves.toHaveLength(2);

    const memberships = await dataSource.getRepository(CampaignPlayer).find({
      where: { player: { id: player.id } },
    });
    expect(memberships).toHaveLength(1);
  });

  it('orders campaign history newest-first across Portuguese and English months', async () => {
    const campaignRepository = dataSource.getRepository(Campaign);
    await campaignRepository.save([
      campaignRepository.create({ month: 'Dezembro', year: '2025' }),
      campaignRepository.create({ month: 'January', year: '2026' }),
      campaignRepository.create({ month: 'Setembro', year: '2026' }),
    ]);

    const history = await service.findAllHistory();

    expect(history.map(({ month, year }) => `${month} ${year}`)).toEqual([
      'Setembro 2026',
      'Agosto 2026',
      'January 2026',
      'Dezembro 2025',
    ]);
  });

  it('includes players and their profiles in campaign history', async () => {
    await service.current(player);
    await service.updatePlayerGameInformation(player, {
      played_the_game: true,
      finished_the_game: false,
    });

    const currentCampaign = (await service.findAllHistory()).find(
      (campaign) => campaign.current,
    );

    expect(currentCampaign?.players).toHaveLength(1);
    expect(currentCampaign?.players[0].player.name).toBe('Player');
  });
});

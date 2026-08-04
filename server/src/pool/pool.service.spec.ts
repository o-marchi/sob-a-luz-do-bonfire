import { DataSource } from 'typeorm';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { Game } from '../games/entities/game.entity';
import { GameRecommendation } from '../games/entities/game-recommendation.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from './entities/pool-option.entity';
import { Pool } from './entities/pool.entity';
import { PoolService } from './pool.service';

describe('PoolService', () => {
  let dataSource: DataSource;
  let service: PoolService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      entities: [
        Campaign,
        CampaignPlayer,
        Game,
        GameRecommendation,
        Player,
        Pool,
        PoolOption,
      ],
      synchronize: true,
    });
    await dataSource.initialize();
    service = new PoolService(dataSource.getRepository(Pool), dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('replaces pool options when updating a pool', async () => {
    const gameRepository = dataSource.getRepository(Game);
    const games = await gameRepository.save([
      gameRepository.create({ title: 'Original game' }),
      gameRepository.create({ title: 'Replacement game' }),
    ]);
    const pool = await service.create({ options: [{ gameId: games[0].id }] });

    const updatedPool = await service.update(pool.id, {
      options: [{ gameId: games[1].id }],
    });

    expect(updatedPool.options.map((option) => option.game.id)).toEqual([
      games[1].id,
    ]);
    await expect(dataSource.getRepository(PoolOption).count()).resolves.toBe(1);
  });

  it('automatically adds active user recommendations to a new pool', async () => {
    const gameRepository = dataSource.getRepository(Game);
    const playerRepository = dataSource.getRepository(Player);
    const requestedGame = await gameRepository.save(
      gameRepository.create({ title: 'Requested game' }),
    );
    const recommendedGame = await gameRepository.save(
      gameRepository.create({
        title: 'Fresh recommendation',
        suggestion: true,
      }),
    );
    const player = await playerRepository.save(
      playerRepository.create({ name: 'Ana' }),
    );
    const campaign = await dataSource.getRepository(Campaign).save(
      dataSource.getRepository(Campaign).create({
        month: 'Agosto',
        year: '2026',
        current: true,
        players: [],
      }),
    );
    await dataSource.getRepository(CampaignPlayer).save(
      dataSource.getRepository(CampaignPlayer).create({
        campaign,
        player,
        suggested_a_game: true,
        suggestedGame: recommendedGame,
      }),
    );
    await dataSource
      .getRepository(GameRecommendation)
      .save(
        dataSource
          .getRepository(GameRecommendation)
          .create({ game: recommendedGame, player }),
      );

    const pool = await service.create({
      options: [{ gameId: requestedGame.id }],
    });

    expect(pool.options.map((option) => option.game.title).sort()).toEqual([
      'Fresh recommendation',
      'Requested game',
    ]);
  });

  it('fills a pool toward five games from eligible Brasas', async () => {
    const gameRepository = dataSource.getRepository(Game);
    const playerRepository = dataSource.getRepository(Player);
    const guaranteed = await gameRepository.save(
      gameRepository.create({ title: 'Guaranteed', suggestion: true }),
    );
    await gameRepository.save(
      ['Alpha', 'Beta', 'Gamma', 'Delta', 'Unused'].map((title) =>
        gameRepository.create({ title, suggestion: true }),
      ),
    );
    const player = await playerRepository.save(
      playerRepository.create({ name: 'Ana' }),
    );
    const campaign = await dataSource.getRepository(Campaign).save(
      dataSource.getRepository(Campaign).create({
        month: 'Agosto',
        year: '2026',
        current: true,
        players: [],
      }),
    );
    await dataSource.getRepository(CampaignPlayer).save(
      dataSource.getRepository(CampaignPlayer).create({
        campaign,
        player,
        suggested_a_game: true,
        suggestedGame: guaranteed,
      }),
    );

    const pool = await service.create({ options: [] });

    expect(pool.options.map((option) => option.game.title)).toEqual([
      'Guaranteed',
      'Alpha',
      'Beta',
      'Delta',
      'Gamma',
    ]);
  });
});

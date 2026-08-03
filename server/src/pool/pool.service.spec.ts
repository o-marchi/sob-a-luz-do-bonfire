import { DataSource } from 'typeorm';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { Game } from '../games/entities/game.entity';
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
      entities: [Campaign, CampaignPlayer, Game, Player, Pool, PoolOption],
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
});

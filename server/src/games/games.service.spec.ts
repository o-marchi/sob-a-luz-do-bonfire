import { DataSource } from 'typeorm';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { Game } from './entities/game.entity';
import { GameRecommendation } from './entities/game-recommendation.entity';
import { GamesService } from './games.service';

describe('GamesService backlog', () => {
  let dataSource: DataSource;
  let service: GamesService;

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

    service = new GamesService(
      dataSource.getRepository(Game),
      dataSource.getRepository(PoolOption),
      dataSource.getRepository(Campaign),
      dataSource.getRepository(GameRecommendation),
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('returns unwon suggestions ordered by distinct election appearances', async () => {
    const games = await saveGames([
      { title: 'Third chance', suggestion: true },
      { title: 'Second chance', suggestion: true },
      { title: 'First chance', suggestion: true },
      { title: 'Fresh suggestion', suggestion: true },
      { title: 'Fourth appearance', suggestion: true },
      { title: 'Already won', suggestion: true },
      { title: 'Not suggested', suggestion: false },
    ]);

    await addAppearances(games[0], 3);
    await addAppearances(games[1], 2);
    await addAppearances(games[2], 1);
    await addAppearances(games[4], 4);
    await addAppearances(games[5], 1);
    await dataSource.getRepository(Campaign).save(
      dataSource.getRepository(Campaign).create({
        month: 'Agosto',
        year: '2026',
        game: games[5],
      }),
    );

    const backlog = await service.findBacklog();

    expect(backlog.retirementThreshold).toBe(3);
    expect(
      backlog.games.map(({ title, electionAppearances }) => [
        title,
        electionAppearances,
      ]),
    ).toEqual([
      ['First chance', 1],
      ['Second chance', 2],
      ['Fresh suggestion', 0],
    ]);
    expect(
      backlog.rubble.map(({ title, electionAppearances }) => [
        title,
        electionAppearances,
      ]),
    ).toEqual([
      ['Fourth appearance', 4],
      ['Third chance', 3],
    ]);
  });

  it('collapses duplicate records and combines their pool appearances', async () => {
    const [first, duplicate] = await saveGames([
      {
        title: 'The Same Game',
        suggestion: true,
        steam: 'https://store.steampowered.com/app/123/The_Same_Game/',
      },
      {
        title: 'The Same Game',
        suggestion: true,
        steam: 'https://store.steampowered.com/app/123/The_Same_Game/',
        cover: 'https://example.com/cover.jpg',
      },
    ]);
    await addAppearances(first, 1);
    await addAppearances(duplicate, 1);

    const backlog = await service.findBacklog();

    expect(backlog.games).toHaveLength(1);
    expect(backlog.rubble).toHaveLength(0);
    expect(backlog.games[0]).toMatchObject({
      id: duplicate.id,
      electionAppearances: 2,
      cover: 'https://example.com/cover.jpg',
    });
  });

  it('returns distinct public recommenders across campaigns and duplicate game records', async () => {
    const [game, duplicate] = await saveGames([
      {
        title: 'Shared suggestion',
        suggestion: true,
        steam: 'https://store.steampowered.com/app/456/shared/',
      },
      {
        title: 'Shared suggestion',
        suggestion: true,
        steam: 'https://store.steampowered.com/app/456/shared/',
      },
    ]);
    const playerRepository = dataSource.getRepository(Player);
    const [ana, bia] = await playerRepository.save([
      playerRepository.create({
        name: 'Ana',
        email: 'private@example.com',
        discord: { avatar: 'https://example.com/ana.png' },
      }),
      playerRepository.create({ name: 'Bia' }),
    ]);
    const recommendationRepository =
      dataSource.getRepository(GameRecommendation);
    await recommendationRepository.save([
      recommendationRepository.create({
        player: ana,
        game,
      }),
      recommendationRepository.create({
        player: ana,
        game: duplicate,
      }),
      recommendationRepository.create({
        player: bia,
        game,
      }),
    ]);

    const backlog = await service.findBacklog();
    const details = await service.findOne(game.id);

    expect(backlog.games).toHaveLength(1);
    expect(backlog.games[0].recommendedBy).toEqual([
      { id: ana.id, name: 'Ana', avatar: 'https://example.com/ana.png' },
      { id: bia.id, name: 'Bia', avatar: null },
    ]);
    expect(details?.recommendedBy).toEqual(backlog.games[0].recommendedBy);
    expect(backlog.games[0].recommendedBy[0]).not.toHaveProperty('email');
  });

  const saveGames = (games: Array<Partial<Game> & Pick<Game, 'title'>>) => {
    const repository = dataSource.getRepository(Game);
    return repository.save(games.map((game) => repository.create(game)));
  };

  const addAppearances = async (game: Game, count: number) => {
    const poolRepository = dataSource.getRepository(Pool);
    const optionRepository = dataSource.getRepository(PoolOption);

    for (let index = 0; index < count; index += 1) {
      await poolRepository.save(
        poolRepository.create({
          options: [optionRepository.create({ game, players: [] })],
        }),
      );
    }
  };
});

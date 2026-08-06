import { DataSource } from 'typeorm';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { Game } from './entities/game.entity';
import { GameRecommendation } from './entities/game-recommendation.entity';
import { findEligibleBacklogGames, GamesService } from './games.service';
import { GameResearchService } from './game-research.service';

describe('GamesService backlog', () => {
  let dataSource: DataSource;
  let service: GamesService;
  let researchService: Pick<
    GameResearchService,
    | 'verifyAssessmentToken'
    | 'searchSteam'
    | 'assessSteamGame'
    | 'assessResearchedGame'
    | 'issueAssessmentToken'
  >;

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

    researchService = {
      verifyAssessmentToken: jest.fn(),
      searchSteam: jest.fn(),
      assessSteamGame: jest.fn(),
      assessResearchedGame: jest.fn(),
      issueAssessmentToken: jest.fn(),
    };
    service = new GamesService(
      dataSource.getRepository(Game),
      dataSource.getRepository(PoolOption),
      dataSource.getRepository(Campaign),
      dataSource.getRepository(GameRecommendation),
      dataSource,
      researchService as GameResearchService,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('refuses to persist a direct HLS trailer URL', () => {
    expect(() =>
      service.create({
        title: 'Streaming Asset',
        trailer: 'https://cdn.example.com/trailer.m3u8',
      }),
    ).toThrow('página navegável');
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

  it('ignores historical options whose pool no longer exists', async () => {
    const [game] = await saveGames([
      { title: 'Still eligible', suggestion: true },
    ]);
    await dataSource.query('PRAGMA foreign_keys = OFF');
    await dataSource.query(
      'INSERT INTO pool_options (game_id, pool_id) VALUES (?, ?)',
      [game.id, 999_999],
    );
    await dataSource.query('PRAGMA foreign_keys = ON');

    await expect(service.findBacklog()).resolves.toMatchObject({
      games: [
        expect.objectContaining({
          id: game.id,
          electionAppearances: 0,
        }),
      ],
    });
    await expect(
      findEligibleBacklogGames(dataSource.manager, new Set()),
    ).resolves.toContainEqual(expect.objectContaining({ id: game.id }));
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

  it('returns matching catalog games before Steam results without duplicates', async () => {
    await saveGames([
      {
        title: 'Hidden Treasure',
        suggestion: false,
        steam: 'https://store.steampowered.com/app/42/',
        cover: 'https://example.com/local.jpg',
      },
    ]);
    jest.mocked(researchService.searchSteam).mockResolvedValue([
      {
        steamAppId: 42,
        title: 'Hidden Treasure',
        image: 'https://example.com/remote.jpg',
        source: 'steam',
      },
      {
        steamAppId: 77,
        title: 'Hidden Treasure II',
        image: null,
        source: 'steam',
      },
    ]);

    await expect(service.searchRecommendations('hidden')).resolves.toEqual([
      {
        steamAppId: 42,
        title: 'Hidden Treasure',
        image: 'https://example.com/local.jpg',
        source: 'catalog',
      },
      {
        steamAppId: 77,
        title: 'Hidden Treasure II',
        image: null,
        source: 'steam',
      },
    ]);
  });

  it('assesses a fully cached game without refetching research', async () => {
    const playerRepository = dataSource.getRepository(Player);
    const player = await playerRepository.save(
      playerRepository.create({ name: 'Ana' }),
    );
    const game = (
      await saveGames([
        {
          title: 'Cached Game',
          suggestion: false,
          steam: 'https://store.steampowered.com/app/42/',
          cover: 'https://example.com/header.jpg',
          trailer: 'https://example.com/trailer.m3u8',
          howLongToBeatUrl: 'https://howlongtobeat.com/game/42',
          durationLabel: '12–18 h',
          mainHours: 12,
          mainExtraHours: 18,
          howLongToBeatTitle: 'Cached Game',
        },
      ])
    )[0];
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
        suggested_a_game: false,
      }),
    );
    jest
      .mocked(researchService.assessResearchedGame)
      .mockImplementation((cachedGame) => ({
        eligible: true,
        reason: 'eligible',
        limitHours: 20,
        game: cachedGame,
      }));
    jest
      .mocked(researchService.issueAssessmentToken)
      .mockReturnValue('cached-token');

    const assessment = await service.assessRecommendation(42, player);

    expect(assessment).toMatchObject({
      eligible: true,
      assessmentToken: 'cached-token',
      game: { title: game.title, trailer: null, mainExtraHours: 18 },
    });
    expect(researchService.assessResearchedGame).toHaveBeenCalledTimes(1);
    expect(researchService.assessSteamGame).not.toHaveBeenCalled();
  });

  it('stores a researched recommendation and charges the current campaign token atomically', async () => {
    const playerRepository = dataSource.getRepository(Player);
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
        played_the_game: false,
        finished_the_game: false,
        partook_in_the_meeting: false,
        suggested_a_game: false,
        suggestedGame: null,
      }),
    );
    jest.mocked(researchService.verifyAssessmentToken).mockReturnValue({
      steamAppId: 42,
      title: 'Example Game',
      cover: 'https://example.com/header.jpg',
      steam: 'https://store.steampowered.com/app/42/',
      trailer: 'https://www.youtube.com/watch?v=example',
      summary: 'A compact adventure.',
      howLongToBeatUrl: 'https://howlongtobeat.com/game/99',
      durationLabel: '12–18 h',
      mainHours: 12,
      mainExtraHours: 18,
      howLongToBeatTitle: 'Example Game',
    });

    const result = await service.recommend('signed-token', player);

    expect(result).toMatchObject({
      created: true,
      alreadyRecommended: false,
      electionAppearances: 0,
      game: {
        title: 'Example Game',
        suggestion: true,
        recommendedBy: [{ id: player.id, name: 'Ana', avatar: null }],
      },
    });
    await expect(
      dataSource.getRepository(CampaignPlayer).findOneOrFail({
        where: { campaign: { id: campaign.id }, player: { id: player.id } },
        relations: ['suggestedGame'],
      }),
    ).resolves.toMatchObject({
      suggested_a_game: true,
      suggestedGame: { title: 'Example Game' },
    });
    await expect(
      dataSource.getRepository(GameRecommendation).count(),
    ).resolves.toBe(1);
    await expect(service.findBacklog()).resolves.toMatchObject({
      games: [
        {
          title: 'Example Game',
          electionAppearances: 0,
          recommendedBy: [{ id: player.id, name: 'Ana', avatar: null }],
        },
      ],
    });
  });

  it('blocks recommendation work while the current election is active', async () => {
    const player = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Ana' }));
    const campaign = await dataSource.getRepository(Campaign).save(
      dataSource.getRepository(Campaign).create({
        month: 'Agosto',
        year: '2026',
        current: true,
        electionActive: true,
        players: [],
      }),
    );
    await dataSource.getRepository(CampaignPlayer).save(
      dataSource.getRepository(CampaignPlayer).create({
        campaign,
        player,
        suggested_a_game: false,
      }),
    );

    await expect(service.searchRecommendations('game')).rejects.toThrow(
      'As sugestões ficam fechadas enquanto a votação está acesa.',
    );
    await expect(service.assessRecommendation(42, player)).rejects.toThrow(
      'As sugestões ficam fechadas enquanto a votação está acesa.',
    );
    await expect(service.recommend('signed-token', player)).rejects.toThrow(
      'As sugestões ficam fechadas enquanto a votação está acesa.',
    );
    await expect(service.withdrawRecommendation(player)).rejects.toThrow(
      'As sugestões ficam fechadas enquanto a votação está acesa.',
    );
    expect(researchService.searchSteam).not.toHaveBeenCalled();
    expect(researchService.assessSteamGame).not.toHaveBeenCalled();
  });

  it('keeps an explicitly re-suggested ashes game in the next-vote shelf', async () => {
    const game = (
      await saveGames([{ title: 'A Return From Ashes', suggestion: true }])
    )[0];
    await addAppearances(game, 3);
    const player = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Ana' }));
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
        suggestedGame: game,
      }),
    );

    const backlog = await service.findBacklog();

    expect(backlog.rubble).toHaveLength(0);
    expect(backlog.games).toContainEqual(
      expect.objectContaining({
        title: 'A Return From Ashes',
        electionAppearances: 3,
        guaranteedNextVote: true,
      }),
    );
  });

  it('withdraws a fresh suggestion without deleting its researched game', async () => {
    const game = (
      await saveGames([
        {
          title: 'Preserved Game',
          suggestion: true,
          cover: 'https://example.com/cover.jpg',
          trailer: 'https://example.com/trailer',
          mainExtraHours: 12,
        },
      ])
    )[0];
    const player = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Ana' }));
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
        suggestedGame: game,
      }),
    );

    await expect(service.withdrawRecommendation(player)).resolves.toMatchObject(
      {
        hiddenFromCatalog: true,
        game: { id: game.id, title: game.title },
      },
    );
    await expect(
      dataSource.getRepository(Game).findOneByOrFail({ id: game.id }),
    ).resolves.toMatchObject({
      suggestion: false,
      cover: 'https://example.com/cover.jpg',
      trailer: 'https://example.com/trailer',
      mainExtraHours: 12,
    });
    await expect(
      dataSource.getRepository(CampaignPlayer).findOneOrFail({
        where: { campaign: { id: campaign.id }, player: { id: player.id } },
        relations: ['suggestedGame'],
      }),
    ).resolves.toMatchObject({
      suggested_a_game: false,
      suggestedGame: null,
    });
  });

  it('retires a historical recommendation from rotation without deleting its provenance or metadata', async () => {
    const game = (
      await saveGames([
        {
          title: 'A Game From Last Year',
          suggestion: true,
          cover: 'https://example.com/cover.jpg',
          trailer: 'https://www.youtube.com/watch?v=historical',
          mainExtraHours: 9,
        },
      ])
    )[0];
    const player = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Ana' }));
    await dataSource
      .getRepository(GameRecommendation)
      .save(
        dataSource.getRepository(GameRecommendation).create({ game, player }),
      );

    await expect(
      service.retireGameFromRotation(game.id, player),
    ).resolves.toMatchObject({
      game: { id: game.id, suggestion: false },
      retiredGameIds: [game.id],
    });
    await expect(
      dataSource.getRepository(Game).findOneByOrFail({ id: game.id }),
    ).resolves.toMatchObject({
      suggestion: false,
      cover: 'https://example.com/cover.jpg',
      trailer: 'https://www.youtube.com/watch?v=historical',
      mainExtraHours: 9,
    });
    await expect(
      dataSource.getRepository(GameRecommendation).count(),
    ).resolves.toBe(1);
    await expect(service.findBacklog()).resolves.toMatchObject({ games: [] });
  });

  it('rejects catalog retirement when the player never recommended the game', async () => {
    const game = (
      await saveGames([{ title: "Someone Else's Game", suggestion: true }])
    )[0];
    const player = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Ana' }));

    await expect(
      service.retireGameFromRotation(game.id, player),
    ).rejects.toThrow('Somente quem sugeriu este jogo');
    await expect(
      dataSource.getRepository(Game).findOneByOrFail({ id: game.id }),
    ).resolves.toMatchObject({ suggestion: true });
  });

  it('keeps a retired game visible until its active election finishes', async () => {
    const game = (
      await saveGames([{ title: 'Already On The Ballot', suggestion: true }])
    )[0];
    const player = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Ana' }));
    await dataSource
      .getRepository(GameRecommendation)
      .save(
        dataSource.getRepository(GameRecommendation).create({ game, player }),
      );
    const pool = await dataSource
      .getRepository(Pool)
      .save(dataSource.getRepository(Pool).create({ options: [] }));
    await dataSource.getRepository(PoolOption).save(
      dataSource.getRepository(PoolOption).create({
        pool,
        game,
        players: [],
      }),
    );
    await dataSource.getRepository(Campaign).save(
      dataSource.getRepository(Campaign).create({
        month: 'Agosto',
        year: '2026',
        current: true,
        electionActive: true,
        pool,
        players: [],
      }),
    );

    await service.retireGameFromRotation(game.id, player);

    await expect(service.findBacklog()).resolves.toMatchObject({
      games: [
        expect.objectContaining({
          id: game.id,
          suggestion: false,
          title: game.title,
        }),
      ],
    });
  });

  it('keeps current-cycle withdrawal separate from historical catalog retirement', async () => {
    const game = (
      await saveGames([{ title: 'Current Suggestion', suggestion: true }])
    )[0];
    const player = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Ana' }));
    await dataSource
      .getRepository(GameRecommendation)
      .save(
        dataSource.getRepository(GameRecommendation).create({ game, player }),
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
        suggestedGame: game,
      }),
    );

    await expect(
      service.retireGameFromRotation(game.id, player),
    ).rejects.toThrow('retirada da sugestão atual');
    await expect(
      dataSource.getRepository(Game).findOneByOrFail({ id: game.id }),
    ).resolves.toMatchObject({ suggestion: true });
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

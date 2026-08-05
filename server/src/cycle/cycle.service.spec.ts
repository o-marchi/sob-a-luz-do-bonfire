import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { GameRecommendation } from '../games/entities/game-recommendation.entity';
import { Game } from '../games/entities/game.entity';
import {
  CatalogGameResearchInput,
  GameResearchService,
} from '../games/game-research.service';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { CycleService } from './cycle.service';
import {
  DiscordCyclePreview,
  DiscordCycleService,
} from './discord-cycle.service';

const disabledDiscordPreview: DiscordCyclePreview = {
  configured: false,
  enabled: false,
  guildId: 'guild',
  channels: { text: [], categories: [], voice: [] },
  plan: {
    oldChannel: null,
    discussionCategory: null,
    historyCategory: null,
    createHistoryCategory: false,
    newChannelName: 'next-game',
    newChannelTopic: 'Next game',
    existingNewChannel: null,
    voiceChannel: null,
    eventName: null,
    gameCard: {
      title: 'Next Game',
      description: 'Next game',
      url: null,
      imageUrl: null,
      details: null,
      marker: 'Sob a Luz do Bonfire · Setembro 2026',
    },
  },
  warnings: [],
  errors: [],
};

describe('CycleService', () => {
  let dataSource: DataSource;
  let service: CycleService;
  let discord: jest.Mocked<
    Pick<DiscordCycleService, 'isConfigured' | 'preview' | 'apply'>
  >;
  let actor: Player;
  let currentGame: Game;
  let campaign: Campaign;
  let gameResearch: jest.Mocked<Pick<GameResearchService, 'assessCatalogGame'>>;
  let assessCatalogGame: jest.MockedFunction<
    GameResearchService['assessCatalogGame']
  >;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      entities: [
        AdminAuditLog,
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

    discord = {
      isConfigured: jest.fn().mockReturnValue(false),
      preview: jest.fn().mockResolvedValue(disabledDiscordPreview),
      apply: jest.fn().mockResolvedValue({
        archivedChannelId: null,
        historyCategoryId: null,
        newChannelId: null,
        eventId: null,
        eventUrl: null,
        gameMessageId: null,
        gameMessageUrl: null,
      }),
    };
    assessCatalogGame = jest
      .fn()
      .mockImplementation((game: CatalogGameResearchInput) =>
        Promise.resolve({
          eligible: false,
          reason: 'duration_unavailable',
          limitHours: 20,
          game: {
            steamAppId: 0,
            title: game.title,
            cover: game.cover ?? null,
            steam: game.steam ?? '',
            trailer: game.trailer ?? null,
            summary: game.summary ?? null,
            howLongToBeatUrl: null,
            durationLabel: null,
            mainHours: null,
            mainExtraHours: null,
            howLongToBeatTitle: null,
          },
        }),
      );
    gameResearch = { assessCatalogGame };
    service = new CycleService(
      dataSource.getRepository(Campaign),
      dataSource.getRepository(Game),
      dataSource,
      new ConfigService({ JWT_SECRET: 'cycle-test-secret' }),
      discord as unknown as DiscordCycleService,
      gameResearch as unknown as GameResearchService,
    );

    actor = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Conductor' }));
    currentGame = await saveGame({
      title: 'Current Game',
      suggestion: false,
      mainExtraHours: 12,
    });
    campaign = await dataSource.getRepository(Campaign).save(
      dataSource.getRepository(Campaign).create({
        month: 'Agosto',
        year: '2026',
        current: true,
        game: currentGame,
        players: [],
        electionActive: false,
      }),
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('draws all meeting suggestions and fills the pool with verified eligible games', async () => {
    const suggestion = await saveGame({
      title: 'Meeting Suggestion',
      suggestion: true,
      mainExtraHours: 14,
    });
    await attachSuggestion(suggestion);
    const fillers = await Promise.all(
      ['A', 'B', 'C', 'D', 'E'].map((title) =>
        saveGame({
          title: `Filler ${title}`,
          suggestion: true,
          mainExtraHours: 10,
        }),
      ),
    );
    await saveGame({
      title: 'Unchecked filler',
      suggestion: true,
      mainExtraHours: null,
    });

    const draw = (await service.drawPool()) as {
      guaranteedGames: Game[];
      selectedFillers: Game[];
      revealOrder: Game[];
      excludedUnverified: Game[];
      selectionToken: string;
    };

    expect(draw.guaranteedGames.map((game) => game.id)).toEqual([
      suggestion.id,
    ]);
    expect(draw.selectedFillers).toHaveLength(4);
    const fillerTitles = new Set(fillers.map((game) => game.title));
    const unexpectedFillers = draw.selectedFillers.filter(
      (game) => !fillerTitles.has(game.title),
    );
    expect(unexpectedFillers).toEqual([]);
    expect(draw.revealOrder).toHaveLength(4);
    expect(draw.revealOrder).toEqual(
      expect.arrayContaining(draw.selectedFillers),
    );
    expect(
      draw.excludedUnverified.every(
        (game) => game.title === 'Unchecked filler',
      ),
    ).toBe(true);

    const started = await service.startElection(
      { selectionToken: draw.selectionToken },
      actor,
    );
    expect(started).toMatchObject({
      id: campaign.id,
      electionActive: true,
      electionEndsAt: null,
    });
    expect(started.pool?.options).toHaveLength(5);
    await expect(
      dataSource.getRepository(AdminAuditLog).find(),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'cycle_election_started',
        actor: `player:${actor.id}`,
      }),
    ]);
  });

  it('keeps every meeting suggestion when the group suggests more than five games', async () => {
    const suggestions: Game[] = [];
    for (const index of Array.from({ length: 7 }, (_, value) => value)) {
      const game = await saveGame({
        title: `Meeting Suggestion ${index + 1}`,
        suggestion: true,
        mainExtraHours: 8 + index,
      });
      const playerRepository = dataSource.getRepository(Player);
      const player = await playerRepository.save(
        playerRepository.create({ name: `Recommender ${index + 1}` }),
      );
      await dataSource.getRepository(CampaignPlayer).save(
        dataSource.getRepository(CampaignPlayer).create({
          campaign,
          player,
          suggested_a_game: true,
          suggestedGame: game,
        }),
      );
      suggestions.push(game);
    }
    await saveGame({
      title: 'Catalog game that must not displace a suggestion',
      suggestion: true,
      mainExtraHours: 6,
    });

    const draw = (await service.drawPool()) as {
      guaranteedGames: Game[];
      selectedFillers: Game[];
      revealOrder: Game[];
      selectionToken: string;
    };

    expect(draw.guaranteedGames).toHaveLength(7);
    expect(draw.guaranteedGames.map((game) => game.id)).toEqual(
      expect.arrayContaining(suggestions.map((game) => game.id)),
    );
    expect(draw.selectedFillers).toEqual([]);
    expect(draw.revealOrder).toEqual([]);

    const started = await service.startElection(
      { selectionToken: draw.selectionToken },
      actor,
    );
    expect(started.pool?.options).toHaveLength(7);
  });

  it('researches an unchecked catalog game and fails closed when no duration is found', async () => {
    await saveGame({
      title: 'Unchecked filler',
      suggestion: true,
      steam: 'https://store.steampowered.com/app/42/',
      mainExtraHours: null,
    });

    const draw = (await service.drawPool()) as {
      selectedFillers: Game[];
      excludedUnverified: Game[];
    };

    expect(assessCatalogGame).toHaveBeenCalledTimes(1);
    expect(draw.selectedFillers).toEqual([]);
    expect(draw.excludedUnverified).toEqual([
      expect.objectContaining({
        title: 'Unchecked filler',
        researchStatus: 'duration_unavailable',
      }),
    ]);
  });

  it('undoes an accidentally started election without counting its pool appearances', async () => {
    await Promise.all(
      ['One', 'Two', 'Three', 'Four', 'Five'].map((title) =>
        saveGame({ title, suggestion: true, mainExtraHours: 8 }),
      ),
    );
    const voter = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Early voter' }));
    const draw = (await service.drawPool()) as { selectionToken: string };
    const started = await service.startElection(
      { selectionToken: draw.selectionToken },
      actor,
    );
    const poolId = started.pool?.id;
    const firstOption = started.pool?.options[0];
    if (!poolId || !firstOption) throw new Error('Expected a started pool');
    firstOption.players = [voter];
    await dataSource.getRepository(PoolOption).save(firstOption);

    const cancelled = await service.cancelElection({ confirm: true }, actor);

    expect(cancelled).toMatchObject({
      id: campaign.id,
      electionActive: false,
      electionStartedAt: null,
      electionEndsAt: null,
      electionClosedAt: null,
      pool: null,
    });
    await expect(
      dataSource.getRepository(Pool).findOneBy({ id: poolId }),
    ).resolves.toBeNull();
    await expect(dataSource.getRepository(PoolOption).count()).resolves.toBe(0);
    const cancellationLog = (
      await dataSource.getRepository(AdminAuditLog).find()
    ).find((entry) => entry.action === 'cycle_election_cancelled');
    expect(cancellationLog?.result).toMatchObject({
      discardedVotes: 1,
    });
  });

  it('rejects a draw token after its selection is modified', async () => {
    await Promise.all(
      ['One', 'Two', 'Three', 'Four', 'Five'].map((title) =>
        saveGame({ title, suggestion: true, mainExtraHours: 8 }),
      ),
    );
    const draw = (await service.drawPool()) as { selectionToken: string };
    const tampered = `${draw.selectionToken.slice(0, -1)}x`;

    await expect(
      service.startElection({ selectionToken: tampered }, actor),
    ).rejects.toThrow('Token de confirmação inválido');
    await expect(dataSource.getRepository(Pool).count()).resolves.toBe(0);
  });

  it('closes the old election and creates the next current campaign without replacing history', async () => {
    const winner = await saveGame({
      title: 'Winning Game',
      suggestion: true,
      mainExtraHours: 9,
      summary: 'Uma jornada curta.',
      steam: 'https://store.steampowered.com/app/42/',
    });
    const runnerUp = await saveGame({
      title: 'Runner Up',
      suggestion: true,
      mainExtraHours: 11,
    });
    const voter = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Voter' }));
    await dataSource.getRepository(CampaignPlayer).save(
      dataSource.getRepository(CampaignPlayer).create({
        campaign,
        player: voter,
        played_the_game: true,
        finished_the_game: true,
        partook_in_the_meeting: true,
        suggested_a_game: false,
      }),
    );
    const pool = await dataSource.getRepository(Pool).save(
      dataSource.getRepository(Pool).create({
        options: [
          dataSource.getRepository(PoolOption).create({
            game: winner,
            players: [voter],
          }),
          dataSource.getRepository(PoolOption).create({
            game: runnerUp,
            players: [],
          }),
        ],
      }),
    );
    campaign.pool = pool;
    campaign.electionActive = true;
    await dataSource.getRepository(Campaign).save(campaign);
    const winnerOption = await dataSource
      .getRepository(PoolOption)
      .findOneOrFail({
        where: { pool: { id: pool.id }, game: { id: winner.id } },
        relations: ['players'],
      });
    winnerOption.players = [voter];
    await dataSource.getRepository(PoolOption).save(winnerOption);

    const input = {
      winnerGameId: winner.id,
      month: 'Setembro',
      year: '2026',
      discord: { enabled: false },
    };
    const preview = await service.previewTransition(input);

    expect(preview.errors).toEqual([]);
    expect(preview).toMatchObject({
      valid: true,
      winner: { id: winner.id, title: winner.title },
      campaign: {
        month: 'Setembro',
        year: '2026',
        description: 'Uma jornada curta.',
      },
    });
    expect(preview.confirmationToken).toBeTruthy();

    const applied = (await service.applyTransition(
      {
        ...input,
        confirm: true,
        confirmationToken: preview.confirmationToken ?? '',
      },
      actor,
    )) as { campaign: Campaign };

    expect(applied.campaign).toMatchObject({
      month: 'Setembro',
      year: '2026',
      current: true,
      game: { id: winner.id, title: winner.title },
      electionActive: false,
    });
    await expect(
      dataSource.getRepository(Campaign).findOneOrFail({
        where: { id: campaign.id },
        relations: ['game'],
      }),
    ).resolves.toMatchObject({
      current: false,
      game: { id: currentGame.id, title: currentGame.title },
      electionActive: false,
    });
    expect(discord.apply).toHaveBeenCalledTimes(1);
  });

  async function saveGame(
    game: Partial<Game> & Pick<Game, 'title'>,
  ): Promise<Game> {
    const repository = dataSource.getRepository(Game);
    return repository.save(repository.create(game));
  }

  async function attachSuggestion(game: Game): Promise<void> {
    await dataSource.getRepository(CampaignPlayer).save(
      dataSource.getRepository(CampaignPlayer).create({
        campaign,
        player: actor,
        suggested_a_game: true,
        suggestedGame: game,
      }),
    );
  }
});

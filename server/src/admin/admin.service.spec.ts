import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { ContentService } from '../content/content.service';
import { Game } from '../games/entities/game.entity';
import { GameRecommendation } from '../games/entities/game-recommendation.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { AdminService } from './admin.service';
import { AdminAuditLog } from './entities/admin-audit-log.entity';

describe('AdminService game recommendations', () => {
  let dataSource: DataSource;
  let service: AdminService;
  let campaign: Campaign;
  let player: Player;
  let game: Game;

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

    service = new AdminService(
      dataSource.getRepository(Campaign),
      dataSource.getRepository(CampaignPlayer),
      dataSource.getRepository(Game),
      dataSource.getRepository(GameRecommendation),
      dataSource.getRepository(Player),
      dataSource.getRepository(Pool),
      dataSource,
      new ConfigService({ MCP_ADMIN_TOKEN: 'test-token' }),
      {} as ContentService,
    );

    campaign = await dataSource.getRepository(Campaign).save(
      dataSource.getRepository(Campaign).create({
        month: 'Agosto',
        year: '2026',
        current: true,
        players: [],
      }),
    );
    player = await dataSource
      .getRepository(Player)
      .save(dataSource.getRepository(Player).create({ name: 'Player' }));
    game = await dataSource.getRepository(Game).save(
      dataSource.getRepository(Game).create({
        title: 'Known recommendation',
        suggestion: true,
      }),
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('derives the boolean from a game ID and clears both fields explicitly', async () => {
    const updated = await service.bulkUpdateCampaignParticipants(campaign.id, {
      participants: [
        {
          player: { playerId: player.id },
          suggestedGameId: game.id,
        },
      ],
    });

    expect(updated.players[0]).toMatchObject({
      suggested_a_game: true,
      suggestedGame: { id: game.id, title: game.title },
    });
    await expect(
      dataSource.getRepository(GameRecommendation).findOne({
        where: { game: { id: game.id }, player: { id: player.id } },
      }),
    ).resolves.toBeTruthy();

    const cleared = await service.bulkUpdateCampaignParticipants(campaign.id, {
      participants: [
        {
          player: { playerId: player.id },
          suggested_a_game: false,
        },
      ],
    });

    expect(cleared.players[0].suggested_a_game).toBe(false);
    expect(cleared.players[0].suggestedGame).toBeNull();
  });

  it('links a newly created game by title through the previewed monthly plan', async () => {
    const plan = {
      campaign: { id: campaign.id },
      games: [{ title: 'New recommendation', suggestion: true }],
      participants: [
        {
          player: { playerId: player.id },
          suggestedGameTitle: 'New recommendation',
        },
      ],
    };
    const preview = await service.previewMonthlyPlan(plan);
    const participantAction = preview.actions.find(
      (action) => action.entity === 'campaign_player',
    );

    expect(preview.valid).toBe(true);
    expect(participantAction?.details).toMatchObject({
      suggested_a_game: true,
      suggestedGame: { title: 'New recommendation' },
    });

    const result = await service.applyMonthlyPlan({
      ...plan,
      confirm: true,
      confirmationToken: preview.confirmationToken ?? '',
    });

    expect(result.campaign.players[0]).toMatchObject({
      suggested_a_game: true,
      suggestedGame: { title: 'New recommendation' },
    });
  });

  it('rejects a game reference combined with a false suggestion flag', async () => {
    const preview = await service.previewMonthlyPlan({
      campaign: { id: campaign.id },
      participants: [
        {
          player: { playerId: player.id },
          suggested_a_game: false,
          suggestedGameId: game.id,
        },
      ],
    });

    expect(preview.valid).toBe(false);
    expect(preview.errors).toContain(
      'A suggested game cannot be attached when suggested_a_game is false.',
    );
  });

  it('records historical provenance without inventing a campaign suggestion', async () => {
    const plan = {
      campaign: { id: campaign.id },
      recommendations: [{ player: { playerId: player.id }, gameId: game.id }],
    };
    const preview = await service.previewMonthlyPlan(plan);

    expect(preview.valid).toBe(true);
    expect(preview.actions).toContainEqual(
      expect.objectContaining({
        type: 'create',
        entity: 'game_recommendation',
      }),
    );

    await service.applyMonthlyPlan({
      ...plan,
      confirm: true,
      confirmationToken: preview.confirmationToken ?? '',
    });

    await expect(
      dataSource.getRepository(GameRecommendation).findOne({
        where: { game: { id: game.id }, player: { id: player.id } },
      }),
    ).resolves.toBeTruthy();
    await expect(
      dataSource.getRepository(CampaignPlayer).count(),
    ).resolves.toBe(0);
  });

  it('automatically includes pristine recommendations when creating a pool', async () => {
    await dataSource
      .getRepository(GameRecommendation)
      .save(
        dataSource.getRepository(GameRecommendation).create({ game, player }),
      );

    const pool = await service.createPoolFromGames({});

    expect(pool.options).toHaveLength(1);
    expect(pool.options[0].game).toMatchObject({
      id: game.id,
      title: 'Known recommendation',
    });
  });
});

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { Game } from '../games/entities/game.entity';
import { Player } from '../players/entities/player.entity';
import { PoolOption } from '../pool/entities/pool-option.entity';
import { Pool } from '../pool/entities/pool.entity';
import { User } from '../users/entities/user.entity';

class MetadataDataSource extends DataSource {
  validateMetadata(): Promise<void> {
    return this.buildMetadatas();
  }
}

const entities = [
  AdminAuditLog,
  Campaign,
  CampaignPlayer,
  Game,
  Player,
  Pool,
  PoolOption,
  User,
];

describe('entity metadata', () => {
  it.each(['postgres', 'sqljs'] as const)(
    'uses supported column types for %s',
    async (type) => {
      const dataSource = new MetadataDataSource({ type, entities });

      await expect(dataSource.validateMetadata()).resolves.toBeUndefined();
    },
  );

  it('round-trips audit log JSON with SQL.js', async () => {
    const dataSource = new DataSource({
      type: 'sqljs',
      entities: [AdminAuditLog],
      synchronize: true,
    });

    await dataSource.initialize();

    try {
      const repository = dataSource.getRepository(AdminAuditLog);
      const saved = await repository.save(
        repository.create({
          action: 'test',
          payload: { campaignId: 1 },
          result: { created: true },
        }),
      );

      await expect(
        repository.findOneByOrFail({ id: saved.id }),
      ).resolves.toMatchObject({
        payload: { campaignId: 1 },
        result: { created: true },
      });
    } finally {
      await dataSource.destroy();
    }
  });
});

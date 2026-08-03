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

describe('PostgreSQL entity metadata', () => {
  it('uses supported column types for every entity', async () => {
    const dataSource = new MetadataDataSource({
      type: 'postgres',
      entities: [
        AdminAuditLog,
        Campaign,
        CampaignPlayer,
        Game,
        Player,
        Pool,
        PoolOption,
        User,
      ],
    });

    await expect(dataSource.validateMetadata()).resolves.toBeUndefined();
  });
});

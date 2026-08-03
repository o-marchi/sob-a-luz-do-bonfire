import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';
import { CampaignPlayer } from '../campaign/entities/campaign-player.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { SiteContent } from '../content/entities/site-content.entity';
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
  SiteContent,
  User,
];

describe('database entity metadata', () => {
  it.each(['postgres', 'sqljs'] as const)(
    'uses column types supported by %s',
    async (type) => {
      const dataSource = new MetadataDataSource({ type, entities });

      await expect(dataSource.validateMetadata()).resolves.toBeUndefined();
    },
  );
});

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Player } from '../players/entities/player.entity';

@Injectable()
export class BonfireAdminAccessService {
  private readonly discordIds: Set<string>;

  constructor(config: ConfigService) {
    this.discordIds = new Set(
      (config.get<string>('BONFIRE_ADMIN_DISCORD_IDS') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
  }

  isAdmin(player: Pick<Player, 'discord'> | null | undefined): boolean {
    const discordId = player?.discord?.id?.trim();
    return Boolean(discordId && this.discordIds.has(discordId));
  }
}

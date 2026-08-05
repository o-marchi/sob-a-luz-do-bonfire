import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Player } from '../players/entities/player.entity';

@Injectable()
export class BonfireAdminAccessService {
  private readonly conductorDiscordId: string;

  constructor(config: ConfigService) {
    this.conductorDiscordId =
      config.get<string>('BONFIRE_CONDUCTOR_DISCORD_ID')?.trim() ?? '';
  }

  isAdmin(player: Pick<Player, 'discord'> | null | undefined): boolean {
    const discordId = player?.discord?.id?.trim();
    return Boolean(
      discordId &&
        this.conductorDiscordId &&
        discordId === this.conductorDiscordId,
    );
  }
}

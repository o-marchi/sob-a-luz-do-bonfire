import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEFAULT_BONFIRE_DISCORD_GUILD_ID = '1534325844619821170';

type DiscordGuildMember = {
  user?: {
    id?: string;
  };
};

@Injectable()
export class DiscordMembershipService {
  private readonly logger = new Logger(DiscordMembershipService.name);
  private readonly guildId: string;

  constructor(config: ConfigService) {
    this.guildId =
      config.get<string>('DISCORD_GUILD_ID')?.trim() ||
      DEFAULT_BONFIRE_DISCORD_GUILD_ID;
  }

  async assertBonfireMember(
    discordUserId: string,
    accessToken: string,
  ): Promise<void> {
    let response: Response;

    try {
      response = await fetch(
        `https://discord.com/api/v10/users/@me/guilds/${this.guildId}/member`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Could not verify Discord membership: ${reason}`);
      throw new ServiceUnavailableException(
        'Discord membership verification is temporarily unavailable',
      );
    }

    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    ) {
      throw new UnauthorizedException('discord_guild_membership_required');
    }

    if (!response.ok) {
      this.logger.error(
        `Discord membership verification failed with status ${response.status}`,
      );
      throw new ServiceUnavailableException(
        'Discord membership verification is temporarily unavailable',
      );
    }

    let member: DiscordGuildMember;
    try {
      member = (await response.json()) as DiscordGuildMember;
    } catch {
      throw new ServiceUnavailableException(
        'Discord returned an invalid membership response',
      );
    }

    if (member.user?.id !== discordUserId) {
      throw new UnauthorizedException('discord_guild_membership_required');
    }
  }
}

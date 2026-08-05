import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Profile } from 'passport-discord';
import { PlayersService } from '../players/players.service';
import { Player } from '../players/entities/player.entity';
import { MediaStorageService } from '../media/media-storage.service';
import { DiscordMembershipService } from './discord-membership.service';
import { BONFIRE_AUTH_VERSION } from './auth.constants';

export type AuthPlayer = Player;

type DiscordProfileDetails = Profile & {
  email?: string | null;
  global_name?: string | null;
  avatar?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly playersService: PlayersService,
    private readonly jwtService: JwtService,
    private readonly mediaStorageService: MediaStorageService,
    private readonly discordMembershipService: DiscordMembershipService,
  ) {}

  async validateDiscordUser(
    profile: Profile,
    accessToken: string,
  ): Promise<AuthPlayer> {
    const discordProfile = profile as DiscordProfileDetails;
    await this.discordMembershipService.assertBonfireMember(
      discordProfile.id,
      accessToken,
    );

    let avatar: string | undefined;
    if (discordProfile.avatar) {
      const discordAvatarUrl = this.playersService.buildDiscordAvatarUrl(
        discordProfile.id,
        discordProfile.avatar,
      );
      avatar = await this.storeDiscordAvatar(
        discordProfile.id,
        discordProfile.avatar,
        discordAvatarUrl,
      );
    }
    const dto = {
      email: discordProfile.email ?? undefined,
      name: discordProfile.global_name ?? discordProfile.username,
      discord: {
        id: discordProfile.id,
        username: discordProfile.username,
        globalName: discordProfile.global_name ?? null,
        avatar,
      },
    };

    let player: Player | null = await this.playersService.findByDiscordId(
      dto.discord.id,
    );

    if (!player) {
      player = await this.playersService.create(dto);
    } else {
      player = await this.playersService.update(player.id, dto);
    }

    return player;
  }

  async signToken(player: Player): Promise<string> {
    const { id, email, name, discord } = player;
    return this.jwtService.signAsync({
      id,
      email,
      name,
      discord,
      authVersion: BONFIRE_AUTH_VERSION,
    });
  }

  private async storeDiscordAvatar(
    discordId: string,
    avatarHash: string,
    sourceUrl: string,
  ): Promise<string> {
    try {
      return await this.mediaStorageService.storeDiscordAvatar(
        discordId,
        avatarHash,
        sourceUrl,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Could not mirror Discord avatar to R2; using Discord instead. ${reason}`,
      );
      return sourceUrl;
    }
  }
}

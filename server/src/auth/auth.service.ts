import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Profile } from 'passport-discord';
import { PlayersService } from '../players/players.service';
import { Player } from '../players/entities/player.entity';

export type AuthPlayer = Player & {
  accessToken: string;
};

type DiscordProfileDetails = Profile & {
  email?: string | null;
  global_name?: string | null;
  avatar?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly playersService: PlayersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateDiscordUser(
    profile: Profile,
    accessToken: string,
    refreshToken: string,
  ): Promise<AuthPlayer> {
    void refreshToken;

    const discordProfile = profile as DiscordProfileDetails;
    const dto = {
      email: discordProfile.email ?? undefined,
      name: discordProfile.global_name ?? discordProfile.username,
      discord: {
        id: discordProfile.id,
        username: discordProfile.username,
        globalName: discordProfile.global_name ?? null,
        avatar: discordProfile.avatar
          ? this.playersService.buildDiscordAvatarUrl(
              discordProfile.id,
              discordProfile.avatar,
            )
          : undefined,
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

    return {
      ...player,
      accessToken,
    };
  }

  async signToken(authPlayer: AuthPlayer): Promise<string> {
    return this.jwtService.signAsync(authPlayer);
  }
}

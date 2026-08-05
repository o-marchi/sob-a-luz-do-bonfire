import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PlayersService } from '../../players/players.service';
import { Player } from '../../players/entities/player.entity';
import { BONFIRE_AUTH_VERSION } from '../auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly playerService: PlayersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    id?: unknown;
    authVersion?: unknown;
  }): Promise<Player> {
    if (
      !Number.isInteger(payload.id) ||
      payload.authVersion !== BONFIRE_AUTH_VERSION
    ) {
      throw new UnauthorizedException();
    }

    const player = await this.playerService.findOne(payload.id as number);

    if (!player) {
      throw new UnauthorizedException();
    }

    return player;
  }
}

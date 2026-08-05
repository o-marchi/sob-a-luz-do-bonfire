import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

export type DiscordCallbackRequest = Request & {
  discordAuthenticationError?: 'not_member' | 'unavailable';
};

@Injectable()
export class DiscordCallbackGuard extends AuthGuard('discord') {
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser | null {
    if (!err && user) {
      return user;
    }

    const request = context.switchToHttp().getRequest<DiscordCallbackRequest>();
    request.discordAuthenticationError =
      err?.message === 'discord_guild_membership_required'
        ? 'not_member'
        : 'unavailable';

    return null;
  }
}

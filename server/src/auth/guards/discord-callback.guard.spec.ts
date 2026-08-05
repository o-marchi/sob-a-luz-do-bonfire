import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  DiscordCallbackGuard,
  DiscordCallbackRequest,
} from './discord-callback.guard';

describe('DiscordCallbackGuard', () => {
  const createContext = (request: DiscordCallbackRequest): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  it('lets the controller redirect a rejected non-member', () => {
    const request = {} as DiscordCallbackRequest;
    const guard = new DiscordCallbackGuard();

    expect(
      guard.handleRequest(
        new UnauthorizedException('discord_guild_membership_required'),
        false,
        undefined,
        createContext(request),
      ),
    ).toBeNull();
    expect(request.discordAuthenticationError).toBe('not_member');
  });

  it('preserves an authenticated Discord user', () => {
    const request = {} as DiscordCallbackRequest;
    const guard = new DiscordCallbackGuard();
    const user = { id: 1 };

    expect(
      guard.handleRequest(null, user, undefined, createContext(request)),
    ).toBe(user);
    expect(request.discordAuthenticationError).toBeUndefined();
  });
});

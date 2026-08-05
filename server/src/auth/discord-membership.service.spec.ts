import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_BONFIRE_DISCORD_GUILD_ID,
  DiscordMembershipService,
} from './discord-membership.service';

describe('DiscordMembershipService', () => {
  const service = new DiscordMembershipService({
    get: jest.fn().mockReturnValue(DEFAULT_BONFIRE_DISCORD_GUILD_ID),
  } as unknown as ConfigService);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a Discord user who belongs to the Bonfire server', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'member-id' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      service.assertBonfireMember('member-id', 'access-token'),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://discord.com/api/v10/users/@me/guilds/${DEFAULT_BONFIRE_DISCORD_GUILD_ID}/member`,
      { headers: { Authorization: 'Bearer access-token' } },
    );
  });

  it('rejects a Discord user who is not in the Bonfire server', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 404,
      }),
    );

    await expect(
      service.assertBonfireMember('outsider-id', 'access-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not treat a Discord outage as a membership rejection', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 503,
      }),
    );

    await expect(
      service.assertBonfireMember('member-id', 'access-token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

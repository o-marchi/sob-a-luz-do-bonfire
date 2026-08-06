import { ConfigService } from '@nestjs/config';
import { DiscordCycleService } from './discord-cycle.service';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('DiscordCycleService', () => {
  const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
  });

  it('does not contact Discord when the conductor disables integration explicitly', async () => {
    const service = new DiscordCycleService(new ConfigService({}));

    const preview = await service.preview({
      currentGameTitle: 'Old Game',
      nextGame: { title: 'New Game' },
      nextMonth: 'Setembro',
      nextYear: '2026',
      discord: { enabled: false },
    });

    expect(preview.enabled).toBe(false);
    expect(preview.errors).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('previews and idempotently applies the channel archive, new discussion, and meeting event', async () => {
    const service = new DiscordCycleService(
      new ConfigService({
        DISCORD_BOT_TOKEN: 'protected-test-token',
        DISCORD_GUILD_ID: 'guild-id',
      }),
    );
    const channels = [
      {
        id: 'old-channel',
        name: 'old-game',
        type: 0,
        parent_id: 'discussion-category',
        permission_overwrites: [
          { id: 'guild-id', type: 0, allow: '4', deny: '8' },
        ],
      },
      {
        id: 'discussion-category',
        name: 'Jogos',
        type: 4,
        parent_id: null,
      },
      {
        id: 'history-category',
        name: 'Histórias da Fogueira',
        type: 4,
        parent_id: null,
      },
      { id: 'voice', name: 'Fogueira', type: 2, parent_id: null },
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(channels));

    const meetingAt = '2026-09-24T20:00:00-03:00';
    const preview = await service.preview({
      currentGameTitle: 'Old Game',
      nextGame: {
        title: 'New Game',
        summary: 'A compact adventure.',
        steam: 'https://store.steampowered.com/app/42/',
        durationLabel: '10 h',
      },
      nextMonth: 'Setembro',
      nextYear: '2026',
      meetingAt,
      discord: { enabled: true },
    });

    expect(preview.errors).toEqual([]);
    expect(preview.plan).toMatchObject({
      oldChannel: { id: 'old-channel' },
      historyCategory: { id: 'history-category' },
      voiceChannel: { id: 'voice' },
      newChannelName: 'new-game',
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ ...channels[0], parent_id: 'history-category' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'new-channel',
          name: 'new-game',
          type: 0,
          parent_id: 'discussion-category',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 'game-message', embeds: [] }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'event-id',
          name: 'Encontro de Setembro: New Game',
          channel_id: 'voice',
          scheduled_start_time: meetingAt,
        }),
      );

    const result = await service.apply(
      preview,
      meetingAt,
      'Descrição do encontro',
    );

    expect(result).toEqual({
      archivedChannelId: 'old-channel',
      historyCategoryId: 'history-category',
      newChannelId: 'new-channel',
      eventId: 'event-id',
      eventUrl: 'https://discord.com/events/guild-id/event-id',
      gameMessageId: 'game-message',
      gameMessageUrl:
        'https://discord.com/channels/guild-id/new-channel/game-message',
    });
    const permissionCall = fetchMock.mock.calls.find(([url]) =>
      requestUrl(url).includes('/permissions/guild-id'),
    );
    const permissionBody = permissionCall?.[1]?.body;
    expect(
      typeof permissionBody === 'string' ? JSON.parse(permissionBody) : null,
    ).toEqual({
      type: 0,
      allow: '4',
      deny: String(8 | 2048),
    });
  });

  function requestUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
  }
});

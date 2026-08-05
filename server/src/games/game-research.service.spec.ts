import { ConfigService } from '@nestjs/config';
import { GameResearchService } from './game-research.service';

describe('GameResearchService', () => {
  let service: GameResearchService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    service = new GameResearchService(
      new ConfigService({ JWT_SECRET: 'test-secret' }),
    );
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses and deduplicates Steam autocomplete results', async () => {
    fetchMock.mockResolvedValue(
      htmlResponse(`
        <a data-ds-appid="1245620" href="/app/1245620/">
          <div class="match_name">ELDEN RING &amp; FRIENDS</div>
          <div class="match_img"><img src="https://example.com/elden.jpg"></div>
        </a>
        <a data-ds-appid="1245620" href="/app/1245620/">
          <div class="match_name">Duplicate</div>
          <div class="match_img"><img src="https://example.com/duplicate.jpg"></div>
        </a>
      `),
    );

    await expect(service.searchSteam('elden ring')).resolves.toEqual([
      {
        steamAppId: 1245620,
        title: 'ELDEN RING & FRIENDS',
        image: 'https://example.com/elden.jpg',
        source: 'steam',
      },
    ]);
  });

  it('researches Steam metadata and accepts a game within 20 hours', async () => {
    mockAssessmentRequests(18 * 3600);

    const assessment = await service.assessSteamGame(42);

    expect(assessment).toMatchObject({
      eligible: true,
      reason: 'eligible',
      limitHours: 20,
      game: {
        steamAppId: 42,
        title: 'Example Game',
        cover: 'https://example.com/header.jpg',
        steam: 'https://store.steampowered.com/app/42/',
        trailer: 'https://example.com/trailer.m3u8',
        howLongToBeatUrl: 'https://howlongtobeat.com/game/99',
        durationLabel: '12–18 h',
        mainHours: 12,
        mainExtraHours: 18,
      },
    });
  });

  it('blocks a game whose Main + Extras duration exceeds 20 hours', async () => {
    mockAssessmentRequests(20 * 3600 + 1);

    const assessment = await service.assessSteamGame(42);

    expect(assessment.eligible).toBe(false);
    expect(assessment.reason).toBe('too_long');
    expect(assessment.game.mainExtraHours).toBeGreaterThan(20);
  });

  it('researches a legacy catalog title without replacing its curated identity', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          '2369900': {
            success: true,
            data: {
              type: 'game',
              name: 'Castlevania Dominus Collection',
              header_image: 'https://example.com/collection.jpg',
            },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ token: 'token' }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              game_id: 123,
              game_name: 'Castlevania: Order of Ecclesia',
              game_type: 'game',
              comp_main: 11 * 3600,
              comp_plus: 16 * 3600,
            },
          ],
        }),
      );

    const assessment = await service.assessCatalogGame({
      title: 'Castlevania: Order of Ecclesia',
      steam:
        'https://store.steampowered.com/app/2369900/Castlevania_Dominus_Collection/',
      cover: 'https://example.com/curated.jpg',
      trailer: 'https://example.com/curated-trailer',
      summary: 'Curated summary.',
    });

    expect(assessment).toMatchObject({
      eligible: true,
      game: {
        title: 'Castlevania: Order of Ecclesia',
        cover: 'https://example.com/curated.jpg',
        trailer: 'https://example.com/curated-trailer',
        summary: 'Curated summary.',
        mainExtraHours: 16,
      },
    });
  });

  it('issues player-bound, expiring assessment tokens', () => {
    const game = {
      steamAppId: 42,
      title: 'Example Game',
      cover: null,
      steam: 'https://store.steampowered.com/app/42/',
      trailer: null,
      summary: null,
      howLongToBeatUrl: 'https://howlongtobeat.com/game/99',
      durationLabel: '18 h',
      mainHours: 12,
      mainExtraHours: 18,
      howLongToBeatTitle: 'Example Game',
    };
    const token = service.issueAssessmentToken(game, 7);

    expect(service.verifyAssessmentToken(token, 7)).toEqual(game);
    expect(() => service.verifyAssessmentToken(token, 8)).toThrow(
      'Expired or invalid assessment token',
    );
  });

  const mockAssessmentRequests = (mainExtraSeconds: number) => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          '42': {
            success: true,
            data: {
              type: 'game',
              name: 'Example Game',
              header_image: 'https://example.com/header.jpg',
              short_description: 'A compact adventure.',
              developers: ['Example Studio'],
              publishers: ['Example Publisher'],
              movies: [
                {
                  name: 'Official trailer',
                  hls_h264: 'https://example.com/trailer.m3u8',
                },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        htmlResponse('<script>var ytInitialData = {"contents":[]};</script>'),
      )
      .mockResolvedValueOnce(
        jsonResponse({ token: 'token', hpKey: 'field', hpVal: 'value' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              game_id: 99,
              game_name: 'Example Game',
              game_alias: '',
              game_type: 'game',
              comp_main: 12 * 3600,
              comp_plus: mainExtraSeconds,
            },
          ],
        }),
      );
  };

  const jsonResponse = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  const htmlResponse = (body: string) =>
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
});

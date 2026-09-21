import { HowLongToBeatClient } from './howlongtobeat.client';

const game = {
  game_id: 80101,
  game_name: 'PRAGMATA',
  comp_main: 10 * 3600,
  comp_plus: 16 * 3600,
}; // Synthetic durations; not a live eligibility assertion.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const html = (body: string) => new Response(body);
const requestUrl = (input: Parameters<typeof fetch>[0]): string =>
  input instanceof Request ? input.url : input.toString();

describe('HowLongToBeatClient', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let client: HowLongToBeatClient;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    client = new HowLongToBeatClient();
  });
  afterEach(() => jest.restoreAllMocks());

  const success = () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ token: 'token', hpKey: 'field', hpVal: 'value' }),
      )
      .mockResolvedValueOnce(json({ data: [game] }));
  };

  it('uses the updated endpoint and preserves authentication and search fields', async () => {
    success();
    expect(await client.search(' PRAGMATA ')).toEqual([game]);
    expect(requestUrl(fetchMock.mock.calls[0][0])).toMatch(
      /\/api\/search\/site\/init\?t=/,
    );
    expect(requestUrl(fetchMock.mock.calls[1][0])).toBe(
      'https://howlongtobeat.com/api/search/site',
    );
    const request = fetchMock.mock.calls[1][1]!;
    expect(request.headers).toMatchObject({
      'x-auth-token': 'token',
      'x-hp-key': 'field',
      'x-hp-val': 'value',
    });
    expect(JSON.parse(request.body as string)).toMatchObject({
      searchTerms: ['PRAGMATA'],
      field: 'value',
      searchType: 'games',
    });
    expect(request.redirect).toBe('error');
  });

  it.each([404, 410])(
    'rediscovers a moved endpoint after HTTP %s',
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(json({}, status))
        .mockResolvedValueOnce(
          html(
            '<script src="https://untrusted.example/evil.js"></script><script src="/_next/static/chunks/search.js"></script>',
          ),
        )
        .mockResolvedValueOnce(
          html(
            'const payload={searchType:"games",searchTerms:terms};fetch("/api/new/search",{method:"POST",body:JSON.stringify(payload)});',
          ),
        );
      success();
      expect(await client.search('PRAGMATA')).toEqual([game]);
      expect(requestUrl(fetchMock.mock.calls[3][0])).toMatch(
        /\/api\/new\/search\/init\?t=/,
      );
      expect(requestUrl(fetchMock.mock.calls[4][0])).toBe(
        'https://howlongtobeat.com/api/new/search',
      );
      expect(
        fetchMock.mock.calls.every(
          ([url]) =>
            new URL(requestUrl(url)).origin === 'https://howlongtobeat.com',
        ),
      ).toBe(true);
      // Future searches reuse the discovered endpoint.
      success();
      await client.search('Another game');
      expect(requestUrl(fetchMock.mock.calls[5][0])).toMatch(
        /\/api\/new\/search\/init\?t=/,
      );
    },
  );

  it('refreshes authentication once when the search token expires', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ token: 'expired' }))
      .mockResolvedValueOnce(json({}, 403));
    success();
    expect(await client.search('PRAGMATA')).toEqual([game]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([429, 500, 503])(
    'retries a temporary HTTP %s failure only once',
    async (status) => {
      fetchMock.mockResolvedValue(json({}, status));
      await expect(client.search('PRAGMATA')).rejects.toThrow(`HTTP ${status}`);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('respects Retry-After instead of immediately repeating a rate-limited request', async () => {
    fetchMock.mockResolvedValue(
      new Response('{}', { status: 429, headers: { 'retry-after': '60' } }),
    );
    await expect(client.search('PRAGMATA')).rejects.toThrow('HTTP 429');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a network failure and does not cache the failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockRejectedValueOnce(new TypeError('Network error'));
    await expect(client.search('PRAGMATA')).rejects.toThrow('Network error');
    success();
    expect(await client.search('PRAGMATA')).toEqual([game]);
  });

  it.each([
    null,
    {},
    { data: null },
    { data: [null] },
    { data: [{ game_id: 1 }] },
  ])(
    'rejects malformed data instead of returning no matches: %j',
    async (body) => {
      fetchMock
        .mockResolvedValueOnce(json({ token: 'token' }))
        .mockResolvedValueOnce(json(body));
      await expect(client.search('PRAGMATA')).rejects.toThrow(
        'invalid search data',
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('shares simultaneous searches and caches successful results for six hours', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    success();
    expect(
      await Promise.all([client.search('PRAGMATA'), client.search('pragmata')]),
    ).toEqual([[game], [game]]);
    expect(await client.search('PRAGMATA')).toEqual([game]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now.mockReturnValue(1_000 + 6 * 60 * 60 * 1000);
    success();
    await client.search('PRAGMATA');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not cache an empty result', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ token: 'token' }))
      .mockResolvedValueOnce(json({ data: [] }));
    expect(await client.search('PRAGMATA')).toEqual([]);
    success();
    expect(await client.search('PRAGMATA')).toEqual([game]);
  });

  it('does not guess an endpoint from unrelated or ambiguous scripts', async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(
        html('<script src="/_next/static/chunks/search.js"></script>'),
      )
      .mockResolvedValueOnce(
        html(
          'searchTerms;searchType;fetch("/api/error",{method:"POST"});fetch("/api/unknown",{method:"POST"});',
        ),
      );
    await expect(client.search('PRAGMATA')).rejects.toThrow(
      'Could not identify',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('bounds unsuccessful discovery and keeps one deadline across all requests', async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(
        html(
          Array.from(
            { length: 30 },
            (_, i) => `<script src="/_next/static/chunks/${i}.js"></script>`,
          ).join(''),
        ),
      )
      .mockImplementation(() => Promise.resolve(html('unrelated bundle')));
    await expect(client.search('PRAGMATA')).rejects.toThrow(
      'Could not identify',
    );
    expect(fetchMock).toHaveBeenCalledTimes(26);
    expect(
      new Set(fetchMock.mock.calls.map(([, init]) => init?.signal)).size,
    ).toBe(1);
  });

  it('allows only a same-site API path override', async () => {
    expect(
      () => new HowLongToBeatClient('https://other.example/api/search'),
    ).toThrow();
    client = new HowLongToBeatClient('/api/configured');
    success();
    await client.search('PRAGMATA');
    expect(requestUrl(fetchMock.mock.calls[0][0])).toMatch(
      /\/api\/configured\/init\?t=/,
    );
  });
});

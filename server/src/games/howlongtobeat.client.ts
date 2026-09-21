const BASE_URL = 'https://howlongtobeat.com';
const DEFAULT_SEARCH_PATH = '/api/search/site';
const LOOKUP_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

export interface HltbGame {
  game_id: number;
  game_name: string;
  game_alias?: string;
  game_type?: string;
  comp_main?: number;
  comp_plus?: number;
}

interface SearchAuth {
  token: string;
  hpKey?: string;
  hpVal?: string;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: string | null,
  ) {
    super(`HowLongToBeat returned HTTP ${status}`);
  }
}

/** Public search protocol; never evaluates downloaded JavaScript. */
export class HowLongToBeatClient {
  private searchPath: string;
  private readonly cache = new Map<
    string,
    { expiresAt: number; games: HltbGame[] }
  >();
  private readonly pending = new Map<string, Promise<HltbGame[]>>();
  private discovery: Promise<string> | null = null;

  constructor(searchPath = DEFAULT_SEARCH_PATH) {
    if (!/^\/api\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(searchPath)) {
      throw new Error('HLTB_SEARCH_PATH must be a relative /api/ path');
    }
    this.searchPath = searchPath;
  }

  async search(title: string): Promise<HltbGame[]> {
    const query = title.trim().replace(/\s+/g, ' ');
    const key = query.toLocaleLowerCase('en-US');
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.games;
    this.cache.delete(key);
    const pending = this.pending.get(key);
    if (pending) return pending;

    const request = this.lookup(query);
    this.pending.set(key, request);
    try {
      const games = await request;
      // Do not cache outages or empty searches: a newly released game may appear.
      if (games.length) {
        if (this.cache.size >= MAX_CACHE_ENTRIES) {
          const oldest = this.cache.keys().next();
          if (!oldest.done) this.cache.delete(oldest.value);
        }
        this.cache.set(key, { games, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return games;
    } finally {
      this.pending.delete(key);
    }
  }

  private async lookup(title: string): Promise<HltbGame[]> {
    // One deadline covers initialization, discovery, retry and response bodies.
    const signal = AbortSignal.timeout(LOOKUP_TIMEOUT_MS);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const path = this.searchPath;
        const auth = (await this.json(
          `${path}/init?t=${Date.now()}`,
          signal,
        )) as SearchAuth | null;
        if (!auth || typeof auth.token !== 'string' || !auth.token) {
          throw new Error('HowLongToBeat returned invalid authentication data');
        }
        const payload: Record<string, unknown> = {
          searchType: 'games',
          searchTerms: title.split(/\s+/),
          searchPage: 1,
          size: 20,
          searchOptions: {
            games: {
              userId: 0,
              platform: '',
              sortCategory: 'popular',
              rangeCategory: 'main',
              rangeTime: { min: null, max: null },
              gameplay: {
                perspective: '',
                flow: '',
                genre: '',
                difficulty: '',
              },
              rangeYear: { min: '', max: '' },
              modifier: '',
            },
            users: { sortCategory: 'postcount' },
            lists: { sortCategory: 'follows' },
            filter: '',
            sort: 0,
            randomizer: 0,
          },
          useCache: true,
        };
        if (typeof auth.hpKey === 'string' && typeof auth.hpVal === 'string') {
          payload[auth.hpKey] = auth.hpVal;
        }
        const body = (await this.json(path, signal, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-auth-token': auth.token,
            'x-hp-key': auth.hpKey ?? '',
            'x-hp-val': auth.hpVal ?? '',
          },
          body: JSON.stringify(payload),
        })) as { data?: unknown } | null;
        if (
          !body ||
          !Array.isArray(body.data) ||
          !body.data.every(
            (game: unknown) =>
              !!game &&
              typeof game === 'object' &&
              'game_id' in game &&
              Number.isInteger(game.game_id) &&
              Number(game.game_id) > 0 &&
              'game_name' in game &&
              typeof game.game_name === 'string',
          )
        ) {
          throw new Error('HowLongToBeat returned invalid search data');
        }
        return body.data as HltbGame[];
      } catch (error) {
        if (attempt > 0 || signal.aborted) throw error;
        // Let the user retry later instead of ignoring a provider cooldown.
        if (error instanceof HttpError && error.retryAfter) throw error;
        if (error instanceof HttpError && [404, 410].includes(error.status)) {
          this.searchPath = await this.discoverSearchPath(signal);
        } else if (
          error instanceof TypeError ||
          (error instanceof HttpError &&
            ([401, 403, 429].includes(error.status) || error.status >= 500))
        ) {
          // Refresh the token on the next attempt, with a small bounded backoff.
          await delay(250, undefined, { signal });
        } else {
          throw error;
        }
      }
    }
    throw new Error('HowLongToBeat lookup failed');
  }

  private async discoverSearchPath(signal: AbortSignal): Promise<string> {
    if (this.discovery) return this.discovery;
    this.discovery = this.readSearchPath(signal);
    try {
      return await this.discovery;
    } finally {
      this.discovery = null;
    }
  }

  private async readSearchPath(signal: AbortSignal): Promise<string> {
    const html = await this.text('/', signal);
    const scripts = Array.from(
      html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi),
      (match) => new URL(match[1], BASE_URL),
    ).filter(
      (url) =>
        url.origin === BASE_URL &&
        url.pathname.startsWith('/_next/static/chunks/') &&
        url.pathname.endsWith('.js'),
    );
    const paths = [...new Set(scripts.map((url) => url.pathname))].slice(0, 24);
    for (let index = 0; index < paths.length; index += 4) {
      const chunks = await Promise.allSettled(
        paths.slice(index, index + 4).map((path) => this.text(path, signal)),
      );
      for (const chunk of chunks) {
        if (chunk.status !== 'fulfilled') continue;
        // Only inspect a search bundle, and reject ambiguous endpoint discovery.
        if (
          !chunk.value.includes('searchTerms') ||
          !chunk.value.includes('searchType')
        ) {
          continue;
        }
        const endpoints = new Set(
          Array.from(
            chunk.value.matchAll(
              /fetch\s*\(\s*["'](\/api\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)["']\s*,\s*\{[^}]{0,1500}?method\s*:\s*["']POST["']/g,
            ),
            (match) => match[1],
          ),
        );
        if (endpoints.size === 1) return [...endpoints][0];
      }
    }
    throw new Error('Could not identify the HowLongToBeat search endpoint');
  }

  private async json(
    path: string,
    signal: AbortSignal,
    init?: RequestInit,
  ): Promise<unknown> {
    return JSON.parse(await this.text(path, signal, init)) as unknown;
  }

  private async text(
    path: string,
    signal: AbortSignal,
    init?: RequestInit,
  ): Promise<string> {
    const response = await fetch(new URL(path, BASE_URL), {
      ...init,
      signal,
      redirect: 'error',
      headers: {
        'user-agent': USER_AGENT,
        origin: BASE_URL,
        referer: `${BASE_URL}/`,
        ...init?.headers,
      },
    });
    if (!response.ok)
      throw new HttpError(response.status, response.headers.get('retry-after'));
    return response.text();
  }
}
import { setTimeout as delay } from 'node:timers/promises';

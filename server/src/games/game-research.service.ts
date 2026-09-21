import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeTrailerPageUrl } from './trailer-url';
import { HowLongToBeatClient, HltbGame } from './howlongtobeat.client';

const STEAM_SEARCH_URL = 'https://store.steampowered.com/search/suggest';
const STEAM_DETAILS_URL = 'https://store.steampowered.com/api/appdetails';
const HLTB_URL = 'https://howlongtobeat.com';
const YOUTUBE_SEARCH_URL = 'https://www.youtube.com/results';
const MAX_RECOMMENDATION_HOURS = 20;
const ASSESSMENT_TOKEN_LIFETIME_SECONDS = 15 * 60;
const REQUEST_TIMEOUT_MS = 12_000;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

export interface SteamGameSearchResult {
  steamAppId: number;
  title: string;
  image: string | null;
  source: 'catalog' | 'steam';
}

export type GameAssessmentReason =
  | 'eligible'
  | 'too_long'
  | 'duration_unavailable'
  | 'lookup_failed'
  | 'game_not_found'
  | 'ambiguous_match'
  | 'not_a_game'
  | 'already_played'
  | 'already_suggested';

export interface ResearchedGame {
  steamAppId: number;
  title: string;
  cover: string | null;
  steam: string;
  trailer: string | null;
  summary: string | null;
  howLongToBeatUrl: string | null;
  durationLabel: string | null;
  mainHours: number | null;
  mainExtraHours: number | null;
  howLongToBeatTitle: string | null;
}

export interface GameResearchAssessment {
  eligible: boolean;
  reason: GameAssessmentReason;
  limitHours: number;
  game: ResearchedGame;
}

export interface CatalogGameResearchInput {
  title: string;
  steam: string | null;
  cover?: string | null;
  trailer?: string | null;
  summary?: string | null;
}

interface SteamAppDetails {
  type?: string;
  name?: string;
  steam_appid?: number;
  header_image?: string;
  short_description?: string;
  developers?: string[];
  publishers?: string[];
}

interface SteamAppDetailsResponse {
  success?: boolean;
  data?: SteamAppDetails;
}

interface RecommendationTokenPayload {
  version: 1;
  playerId: number;
  expiresAt: number;
  game: ResearchedGame;
}

interface YoutubeText {
  simpleText?: string;
  runs?: Array<{ text?: string }>;
}

interface YoutubeVideoRenderer {
  videoId?: string;
  title?: YoutubeText;
  ownerText?: YoutubeText;
  ownerBadges?: Array<{
    metadataBadgeRenderer?: {
      style?: string;
      label?: string;
      tooltip?: string;
    };
  }>;
}

const decodeHtml = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

export const normalizeGameTitle = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[™®©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');

const levenshteinDistance = (left: string, right: string): number => {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? 0;
};

const titleSimilarity = (left: string, right: string): number => {
  const normalizedLeft = normalizeGameTitle(left);
  const normalizedRight = normalizeGameTitle(right);

  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const editSimilarity =
    1 -
    levenshteinDistance(normalizedLeft, normalizedRight) /
      Math.max(normalizedLeft.length, normalizedRight.length);
  const leftTokens = new Set(normalizedLeft.split(' '));
  const rightTokens = new Set(normalizedRight.split(' '));
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  );
  const tokenSimilarity =
    intersection.length / new Set([...leftTokens, ...rightTokens]).size;

  return Math.max(editSimilarity, tokenSimilarity);
};

const textValue = (value?: YoutubeText): string =>
  value?.simpleText ?? value?.runs?.map((run) => run.text ?? '').join('') ?? '';

const collectYoutubeVideos = (
  value: unknown,
  videos: YoutubeVideoRenderer[] = [],
): YoutubeVideoRenderer[] => {
  if (!value || typeof value !== 'object') return videos;

  const record = value as Record<string, unknown>;
  if (record.videoRenderer && typeof record.videoRenderer === 'object') {
    videos.push(record.videoRenderer);
  }

  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      child.forEach((entry) => collectYoutubeVideos(entry, videos));
    } else if (child && typeof child === 'object') {
      collectYoutubeVideos(child, videos);
    }
  }

  return videos;
};

const organizationIdentity = (value: string): string => {
  const ignored = new Set([
    'co',
    'company',
    'corp',
    'corporation',
    'entertainment',
    'game',
    'games',
    'inc',
    'interactive',
    'llc',
    'ltd',
    'official',
    'studio',
    'studios',
  ]);

  return normalizeGameTitle(value)
    .split(' ')
    .filter((token) => !ignored.has(token))
    .join(' ');
};

const organizationsMatch = (left: string, right: string): boolean => {
  const normalizedLeft = organizationIdentity(left);
  const normalizedRight = organizationIdentity(right);

  return (
    normalizedLeft.length >= 4 &&
    normalizedRight.length >= 4 &&
    (normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft))
  );
};

const PLATFORM_CHANNELS = ['playstation', 'xbox', 'nintendo'];
const GENERIC_TITLE_TOKENS = new Set([
  'and',
  'edition',
  'game',
  'remake',
  'the',
]);

const hasVerifiedOwnerBadge = (video: YoutubeVideoRenderer): boolean =>
  (video.ownerBadges ?? []).some(({ metadataBadgeRenderer: badge }) =>
    [badge?.style, badge?.label, badge?.tooltip].some((value) =>
      /verified|verificado/i.test(value ?? ''),
    ),
  );

const verifiedChannelMatches = (
  video: YoutubeVideoRenderer,
  title: string,
): boolean => {
  if (!hasVerifiedOwnerBadge(video)) return false;

  const owner = normalizeGameTitle(textValue(video.ownerText));
  if (
    PLATFORM_CHANNELS.some((platform) => owner.split(' ').includes(platform))
  ) {
    return true;
  }

  const franchiseTokens = normalizeGameTitle(title)
    .split(' ')
    .filter((token) => token.length >= 3 && !GENERIC_TITLE_TOKENS.has(token));
  const matchingTokens = franchiseTokens.filter((token) =>
    owner.split(' ').includes(token),
  );
  const requiredMatches = Math.min(2, franchiseTokens.length);

  return requiredMatches > 0 && matchingTokens.length >= requiredMatches;
};

const formatHours = (hours: number): string => {
  const rounded = Math.round(hours * 2) / 2;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',');
};

@Injectable()
export class GameResearchService {
  private readonly logger = new Logger(GameResearchService.name);

  private readonly hltb: HowLongToBeatClient;

  constructor(private readonly config: ConfigService) {
    this.hltb = new HowLongToBeatClient(config.get<string>('HLTB_SEARCH_PATH'));
  }

  async searchSteam(query: string): Promise<SteamGameSearchResult[]> {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');
    if (normalizedQuery.length < 2) return [];

    const url = new URL(STEAM_SEARCH_URL);
    url.search = new URLSearchParams({
      term: normalizedQuery,
      f: 'games',
      cc: 'BR',
      l: 'portuguese',
    }).toString();

    const html = await this.fetchText(url, 'Steam search');
    const results: SteamGameSearchResult[] = [];
    const seenAppIds = new Set<number>();
    const matches = html.matchAll(
      /<a\b[^>]*data-ds-appid="(\d+)"[^>]*>[\s\S]*?<div class="match_name">([\s\S]*?)<\/div>[\s\S]*?<div class="match_img"><img src="([^"]+)"/gi,
    );

    for (const match of matches) {
      const steamAppId = Number(match[1]);
      if (!Number.isInteger(steamAppId) || seenAppIds.has(steamAppId)) continue;

      seenAppIds.add(steamAppId);
      results.push({
        steamAppId,
        title: decodeHtml((match[2] ?? '').replace(/<[^>]+>/g, '')).trim(),
        image: decodeHtml(match[3] ?? '').trim() || null,
        source: 'steam',
      });

      if (results.length >= 8) break;
    }

    return results;
  }

  async assessSteamGame(steamAppId: number): Promise<GameResearchAssessment> {
    const steamDetails = await this.getSteamDetails(steamAppId);
    const title = steamDetails.name?.trim() || `Steam App ${steamAppId}`;
    const steam = `https://store.steampowered.com/app/${steamAppId}/`;
    const baseGame: ResearchedGame = {
      steamAppId,
      title,
      cover: steamDetails.header_image ?? null,
      steam,
      trailer: await this.findOfficialTrailer(steamDetails, title),
      summary: steamDetails.short_description?.trim() || null,
      howLongToBeatUrl: null,
      durationLabel: null,
      mainHours: null,
      mainExtraHours: null,
      howLongToBeatTitle: null,
    };

    if (steamDetails.type !== 'game') {
      return this.assessment(false, 'not_a_game', baseGame);
    }

    return this.assessDuration(baseGame);
  }

  async assessCatalogGame(
    input: CatalogGameResearchInput,
  ): Promise<GameResearchAssessment> {
    const appIdMatch = input.steam?.match(
      /store\.steampowered\.com\/app\/(\d+)/i,
    );
    const steamAppId = appIdMatch ? Number(appIdMatch[1]) : NaN;
    if (!Number.isInteger(steamAppId) || steamAppId < 1) {
      return this.assessment(false, 'duration_unavailable', {
        steamAppId: 0,
        title: input.title,
        cover: input.cover ?? null,
        steam: input.steam ?? '',
        trailer: normalizeTrailerPageUrl(input.trailer),
        summary: input.summary ?? null,
        howLongToBeatUrl: null,
        durationLabel: null,
        mainHours: null,
        mainExtraHours: null,
        howLongToBeatTitle: null,
      });
    }

    const steamDetails = await this.getSteamDetails(steamAppId);
    const title = input.title.trim();
    const baseGame: ResearchedGame = {
      steamAppId,
      title,
      cover: input.cover ?? steamDetails.header_image ?? null,
      steam: input.steam ?? `https://store.steampowered.com/app/${steamAppId}/`,
      trailer:
        normalizeTrailerPageUrl(input.trailer) ??
        (await this.findOfficialTrailer(steamDetails, title)),
      summary: input.summary ?? steamDetails.short_description?.trim() ?? null,
      howLongToBeatUrl: null,
      durationLabel: null,
      mainHours: null,
      mainExtraHours: null,
      howLongToBeatTitle: null,
    };

    if (steamDetails.type !== 'game') {
      return this.assessment(false, 'not_a_game', baseGame);
    }

    return this.assessDuration(baseGame);
  }

  private async assessDuration(
    baseGame: ResearchedGame,
  ): Promise<GameResearchAssessment> {
    let match: { game: HltbGame | null; reason: GameAssessmentReason };
    try {
      match = await this.findHowLongToBeatMatch(baseGame.title);
    } catch (error: unknown) {
      this.logger.warn(
        `HowLongToBeat lookup failed for Steam ${baseGame.steamAppId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return this.assessment(false, 'lookup_failed', baseGame);
    }
    const hltbMatch = match.game;
    if (!hltbMatch) return this.assessment(false, match.reason, baseGame);

    const validHours = (seconds: unknown): number | null =>
      typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
        ? seconds / 3600
        : null;
    const mainHours = validHours(hltbMatch.comp_main);
    const mainExtraHours = validHours(hltbMatch.comp_plus);
    const durationLabel =
      mainExtraHours === null
        ? null
        : mainHours && Math.abs(mainHours - mainExtraHours) >= 0.25
          ? `${formatHours(mainHours)}–${formatHours(mainExtraHours)} h`
          : `${formatHours(mainExtraHours)} h`;

    return this.assessResearchedGame({
      ...baseGame,
      howLongToBeatUrl: `${HLTB_URL}/game/${hltbMatch.game_id}`,
      durationLabel,
      mainHours,
      mainExtraHours,
      howLongToBeatTitle: hltbMatch.game_name.trim(),
    });
  }

  assessResearchedGame(game: ResearchedGame): GameResearchAssessment {
    if (
      typeof game.mainExtraHours !== 'number' ||
      !Number.isFinite(game.mainExtraHours) ||
      game.mainExtraHours <= 0
    ) {
      return this.assessment(false, 'duration_unavailable', game);
    }

    return this.assessment(
      game.mainExtraHours <= MAX_RECOMMENDATION_HOURS,
      game.mainExtraHours <= MAX_RECOMMENDATION_HOURS ? 'eligible' : 'too_long',
      game,
    );
  }

  issueAssessmentToken(game: ResearchedGame, playerId: number): string {
    const payload: RecommendationTokenPayload = {
      version: 1,
      playerId,
      expiresAt:
        Math.floor(Date.now() / 1000) + ASSESSMENT_TOKEN_LIFETIME_SECONDS,
      game,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );

    return `${encodedPayload}.${this.signTokenPayload(encodedPayload)}`;
  }

  verifyAssessmentToken(token: string, playerId: number): ResearchedGame {
    const [encodedPayload, providedSignature, extra] = token.split('.');
    if (!encodedPayload || !providedSignature || extra) {
      throw new Error('Invalid assessment token');
    }

    const expectedSignature = this.signTokenPayload(encodedPayload);
    const provided = Buffer.from(providedSignature, 'base64url');
    const expected = Buffer.from(expectedSignature, 'base64url');

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new Error('Invalid assessment token');
    }

    let payload: RecommendationTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as RecommendationTokenPayload;
    } catch {
      throw new Error('Invalid assessment token');
    }

    if (
      payload.version !== 1 ||
      payload.playerId !== playerId ||
      payload.expiresAt < Math.floor(Date.now() / 1000) ||
      !Number.isInteger(payload.game?.steamAppId) ||
      !payload.game?.title ||
      typeof payload.game.mainExtraHours !== 'number' ||
      !Number.isFinite(payload.game.mainExtraHours) ||
      payload.game.mainExtraHours <= 0 ||
      payload.game.mainExtraHours > MAX_RECOMMENDATION_HOURS
    ) {
      throw new Error('Expired or invalid assessment token');
    }

    return payload.game;
  }

  private assessment(
    eligible: boolean,
    reason: GameAssessmentReason,
    game: ResearchedGame,
  ): GameResearchAssessment {
    return { eligible, reason, limitHours: MAX_RECOMMENDATION_HOURS, game };
  }

  private async getSteamDetails(steamAppId: number): Promise<SteamAppDetails> {
    const url = new URL(STEAM_DETAILS_URL);
    url.search = new URLSearchParams({
      appids: String(steamAppId),
      cc: 'br',
      l: 'portuguese',
    }).toString();
    const response = await this.fetchJson<
      Record<string, SteamAppDetailsResponse>
    >(url, 'Steam game details');
    const app = response[String(steamAppId)];

    if (!app?.success || !app.data) {
      throw new ServiceUnavailableException(
        'A Steam não retornou detalhes para este jogo.',
      );
    }

    return app.data;
  }

  private async findHowLongToBeatMatch(
    title: string,
  ): Promise<{ game: HltbGame | null; reason: GameAssessmentReason }> {
    const results = await this.hltb.search(title);
    const numbers = (value: string) =>
      normalizeGameTitle(value).match(/\d+/g)?.join(',') ?? '';
    const scored = [
      ...new Map(results.map((entry) => [entry.game_id, entry])).values(),
    ]
      .filter(
        (entry) =>
          entry.game_name && !['mod', 'dlc'].includes(entry.game_type ?? ''),
      )
      .map((entry) => ({
        entry,
        score: Math.max(
          ...[entry.game_name, ...(entry.game_alias ?? '').split(/[;\n]/)].map(
            (name) =>
              numbers(title) === numbers(name)
                ? titleSimilarity(title, name)
                : 0,
          ),
        ),
      }))
      .sort((left, right) => right.score - left.score);
    const best = scored[0];
    const second = scored[1];

    if (!best || best.score < 0.72)
      return { game: null, reason: 'game_not_found' };
    if (
      second &&
      (best.score === 1 ? second.score === 1 : best.score - second.score < 0.08)
    ) {
      return { game: null, reason: 'ambiguous_match' };
    }
    return { game: best.entry, reason: 'eligible' };
  }

  private async findOfficialTrailer(
    details: SteamAppDetails,
    title: string,
  ): Promise<string | null> {
    const organizations = [
      ...(details.publishers ?? []),
      ...(details.developers ?? []),
    ];

    try {
      const query =
        `${title} official trailer ${organizations[0] ?? ''}`.trim();
      const url = new URL(YOUTUBE_SEARCH_URL);
      url.searchParams.set('search_query', query);
      const html = await this.fetchText(url, 'YouTube trailer search');
      const marker = 'var ytInitialData = ';
      const start = html.indexOf(marker);
      const end = start >= 0 ? html.indexOf(';</script>', start) : -1;

      if (start >= 0 && end > start) {
        const initialData = JSON.parse(
          html.slice(start + marker.length, end),
        ) as unknown;
        const videos = collectYoutubeVideos(initialData);
        const normalizedTitle = normalizeGameTitle(title);
        const titleTokens = normalizedTitle.split(' ').filter(Boolean);
        const official = videos.find((video) => {
          const videoTitle = normalizeGameTitle(textValue(video.title));
          const owner = textValue(video.ownerText);
          const titleMatches = titleTokens
            .slice(0, Math.min(3, titleTokens.length))
            .every((token) => videoTitle.includes(token));
          const trailerMatches = /trailer|announce|reveal|gameplay/.test(
            videoTitle,
          );
          const ownerMatches = organizations.some((organization) =>
            organizationsMatch(organization, owner),
          );
          const verifiedOfficialChannel = verifiedChannelMatches(video, title);

          return Boolean(
            video.videoId &&
              titleMatches &&
              trailerMatches &&
              (ownerMatches || verifiedOfficialChannel),
          );
        });

        if (official?.videoId) {
          return `https://www.youtube.com/watch?v=${official.videoId}`;
        }
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Official trailer lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return null;
  }

  private signTokenPayload(encodedPayload: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(encodedPayload)
      .digest('base64url');
  }

  private async fetchText(url: URL, label: string): Promise<string> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'user-agent': USER_AGENT, referer: `${url.origin}/` },
      });

      if (!response.ok) {
        throw new Error(`${label} returned HTTP ${response.status}`);
      }

      return response.text();
    } catch (error: unknown) {
      this.logger.warn(
        `${label} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      throw new ServiceUnavailableException(
        `Não foi possível consultar ${label} agora.`,
      );
    }
  }

  private async fetchJson<T>(url: URL, label: string): Promise<T> {
    const response = await this.fetchText(url, label);

    try {
      return JSON.parse(response) as T;
    } catch {
      throw new ServiceUnavailableException(
        `${label} retornou uma resposta inválida.`,
      );
    }
  }
}

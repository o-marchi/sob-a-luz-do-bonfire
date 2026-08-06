import { ValidateBy, type ValidationOptions } from 'class-validator';

const DIRECT_MEDIA_EXTENSION =
  /\.(?:m3u8|m3u|mp4|m4v|mov|webm|mkv|avi)(?:$|[?#])/i;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);

export const normalizeTrailerPageUrl = (
  value: string | null | undefined,
): string | null => {
  const candidate = value?.trim();
  if (!candidate || DIRECT_MEDIA_EXTENSION.test(candidate)) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    const host = url.hostname.toLocaleLowerCase('en-US');
    if (YOUTUBE_HOSTS.has(host)) {
      const isWatchPage =
        url.pathname === '/watch' && Boolean(url.searchParams.get('v'));
      const isShortPage = /^\/shorts\/[^/]+\/?$/.test(url.pathname);
      return isWatchPage || isShortPage ? candidate : null;
    }

    if (host === 'youtu.be') {
      return /^\/[^/]+\/?$/.test(url.pathname) ? candidate : null;
    }

    return candidate;
  } catch {
    return null;
  }
};

export const isTrailerPageUrl = (value: unknown): boolean =>
  typeof value === 'string' && normalizeTrailerPageUrl(value) !== null;

export const IsTrailerPageUrl = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isTrailerPageUrl',
      validator: {
        validate: isTrailerPageUrl,
        defaultMessage: () =>
          'trailer must be a navigable HTTP page, not a direct video or HLS playlist',
      },
    },
    validationOptions,
  );

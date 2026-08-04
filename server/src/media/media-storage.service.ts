import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type MediaCategory = 'avatars' | 'banners' | 'pictures' | 'assets';

type UploadMediaObject = {
  category: MediaCategory;
  objectName: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
};

type StorageConfiguration = {
  bucket: string;
  publicBaseUrl: string;
};

const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;
const REMOTE_IMAGE_TIMEOUT_MS = 10_000;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly client: S3Client | null;
  private readonly storage: StorageConfiguration | null;
  private readonly prefixes: Record<MediaCategory, string>;

  constructor(private readonly config: ConfigService) {
    this.prefixes = {
      avatars: this.readPrefix('R2_AVATAR_PREFIX', 'avatars'),
      banners: this.readPrefix('R2_BANNER_PREFIX', 'banners'),
      pictures: this.readPrefix('R2_PICTURE_PREFIX', 'pictures'),
      assets: this.readPrefix('R2_ASSET_PREFIX', 'assets'),
    };

    const endpoint = this.readOptional('R2_ENDPOINT');
    const bucket = this.readOptional('R2_BUCKET');
    const accessKeyId = this.readOptional('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.readOptional('R2_SECRET_ACCESS_KEY');
    const publicBaseUrl = this.readOptional('R2_PUBLIC_BASE_URL');
    const values = [
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl,
    ];

    if (values.every((value) => !value)) {
      this.client = null;
      this.storage = null;
      return;
    }

    if (
      !endpoint ||
      !bucket ||
      !accessKeyId ||
      !secretAccessKey ||
      !publicBaseUrl
    ) {
      this.logger.warn(
        'R2 media storage is disabled because its configuration is incomplete.',
      );
      this.client = null;
      this.storage = null;
      return;
    }

    this.client = new S3Client({
      region: this.readOptional('R2_REGION') ?? 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.storage = {
      bucket,
      publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
    };
  }

  isConfigured(): boolean {
    return this.client !== null && this.storage !== null;
  }

  async storeDiscordAvatar(
    discordId: string,
    avatarHash: string,
    sourceUrl: string,
  ): Promise<string> {
    if (!this.isConfigured()) {
      return sourceUrl;
    }

    this.assertDiscordAvatarSource(discordId, avatarHash, sourceUrl);

    const response = await fetch(sourceUrl, {
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(REMOTE_IMAGE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `Discord returned HTTP ${response.status} for an avatar.`,
      );
    }

    const contentType = response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase();

    if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new Error('Discord returned an unsupported avatar format.');
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_REMOTE_IMAGE_BYTES
    ) {
      throw new Error('Discord avatar is larger than the storage limit.');
    }

    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error('Discord avatar is larger than the storage limit.');
    }

    const extension = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return this.upload({
      category: 'avatars',
      objectName: `discord/${discordId}/${avatarHash}.${extension}`,
      body,
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    });
  }

  async upload(object: UploadMediaObject): Promise<string> {
    if (!this.client || !this.storage) {
      throw new Error('R2 media storage is not configured.');
    }

    const objectName = this.normalizeObjectName(object.objectName);
    const key = `${this.prefixes[object.category]}/${objectName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.storage.bucket,
        Key: key,
        Body: object.body,
        ContentType: object.contentType,
        CacheControl: object.cacheControl,
      }),
    );

    return `${this.storage.publicBaseUrl}/${key
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  }

  private assertDiscordAvatarSource(
    discordId: string,
    avatarHash: string,
    sourceUrl: string,
  ): void {
    if (!/^\d+$/.test(discordId)) {
      throw new Error('Invalid Discord user ID.');
    }

    if (!/^(?:a_)?[a-f\d]+$/i.test(avatarHash)) {
      throw new Error('Invalid Discord avatar hash.');
    }

    const extension = avatarHash.startsWith('a_') ? 'gif' : 'png';
    const expectedUrl = `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${extension}`;

    if (sourceUrl !== expectedUrl) {
      throw new Error('Invalid Discord avatar source.');
    }
  }

  private normalizeObjectName(objectName: string): string {
    const normalized = objectName.replace(/^\/+|\/+$/g, '');

    if (
      !normalized ||
      normalized
        .split('/')
        .some((part) => !part || part === '.' || part === '..') ||
      !/^[a-zA-Z0-9._/-]+$/.test(normalized)
    ) {
      throw new Error('Invalid media object name.');
    }

    return normalized;
  }

  private readPrefix(name: string, fallback: string): string {
    const prefix = this.readOptional(name) ?? fallback;
    return this.normalizeObjectName(prefix);
  }

  private readOptional(name: string): string | undefined {
    const value = this.config.get<string>(name)?.trim();
    return value || undefined;
  }
}

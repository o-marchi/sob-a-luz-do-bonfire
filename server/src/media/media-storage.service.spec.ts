import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { MediaStorageService } from './media-storage.service';

const storageConfig = {
  R2_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
  R2_BUCKET: 'sob-a-luz-do-bonfire',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
  R2_PUBLIC_BASE_URL: 'https://media.example.com/',
};

describe('MediaStorageService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the original avatar URL when R2 is not configured', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = new MediaStorageService(new ConfigService({}));
    const sourceUrl =
      'https://cdn.discordapp.com/avatars/1234/abcdef123456.png';

    await expect(
      service.storeDiscordAvatar('1234', 'abcdef123456', sourceUrl),
    ).resolves.toBe(sourceUrl);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stores a Discord avatar under its immutable R2 key', async () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const sendSpy = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const service = new MediaStorageService(new ConfigService(storageConfig));
    const sourceUrl =
      'https://cdn.discordapp.com/avatars/1234/abcdef123456.png';

    await expect(
      service.storeDiscordAvatar('1234', 'abcdef123456', sourceUrl),
    ).resolves.toBe(
      'https://media.example.com/avatars/discord/1234/abcdef123456.png',
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(sourceUrl);
    expect(fetchSpy.mock.calls[0][1]?.headers).toEqual({ Accept: 'image/*' });
    expect(fetchSpy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    const command = sendSpy.mock.calls[0][0] as PutObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: 'sob-a-luz-do-bonfire',
      Key: 'avatars/discord/1234/abcdef123456.png',
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(command.input.Body).toEqual(body);
  });

  it('rejects avatar URLs that are not the expected Discord CDN object', async () => {
    const service = new MediaStorageService(new ConfigService(storageConfig));

    await expect(
      service.storeDiscordAvatar(
        '1234',
        'abcdef123456',
        'https://example.com/avatar.png',
      ),
    ).rejects.toThrow('Invalid Discord avatar source.');
  });

  it('rejects remote responses that exceed the image limit', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array(), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': String(8 * 1024 * 1024 + 1),
        },
      }),
    );
    const sendSpy = jest.spyOn(S3Client.prototype, 'send');
    const service = new MediaStorageService(new ConfigService(storageConfig));
    const sourceUrl =
      'https://cdn.discordapp.com/avatars/1234/abcdef123456.png';

    await expect(
      service.storeDiscordAvatar('1234', 'abcdef123456', sourceUrl),
    ).rejects.toThrow('Discord avatar is larger than the storage limit.');
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

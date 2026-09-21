import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ImageImportService, MAX_IMAGE_BYTES } from './image-import.service';
import { MediaStorageService } from './media-storage.service';

describe('ImageImportService', () => {
  let body: Buffer;
  let service: ImageImportService;
  let upload: jest.Mock;
  const source = 'https://i.postimg.cc/example/cover.png';
  const url = 'https://pub-example.r2.dev/banners/image.png';
  const imageResponse = (bytes: Uint8Array, status = 200) =>
    new Response(bytes, { status, headers: { 'content-type': 'image/png' } });

  beforeEach(async () => {
    body = await sharp({
      create: { width: 4, height: 3, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    upload = jest.fn().mockResolvedValue(url);
    service = new ImageImportService({
      isConfigured: () => true,
      upload,
    } as unknown as MediaStorageService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('preserves original bytes under a content hash and verifies the public copy', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(imageResponse(body))
      .mockResolvedValueOnce(imageResponse(body));
    const sha256 = createHash('sha256').update(body).digest('hex');
    await expect(service.importRemote(source)).resolves.toMatchObject({
      url,
      sha256,
      width: 4,
      height: 3,
      bytes: body.length,
    });
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        body,
        category: 'banners',
        objectName: `${sha256}.png`,
        contentType: 'image/png',
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      source,
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it('rejects a 503 response even when it contains a valid PNG error graphic', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(imageResponse(body, 503));
    await expect(service.importRemote(source)).rejects.toThrow('HTTP 503');
    expect(upload).not.toHaveBeenCalled();
  });

  it.each([
    'http://i.postimg.cc/a.png',
    'https://i.postimg.cc.evil.example/a.png',
    'https://localhost/a.png',
    'https://127.0.0.1/a.png',
    'https://user:pass@i.postimg.cc/a.png',
    'https://i.postimg.cc:444/a.png',
  ])('rejects unsupported source %s before making a request', async (input) => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(service.importRemote(input)).rejects.toThrow(
      'direct HTTPS image',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses to return a URL when the public copy differs', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(imageResponse(new Uint8Array([1, 2, 3])));
    await expect(service.upload(body)).rejects.toThrow('failed verification');
  });

  it('rejects HTML disguised as an image and mismatched content types', async () => {
    await expect(
      service.upload(Buffer.from('<html>Not an image</html>')),
    ).rejects.toThrow('Invalid');
    await expect(service.upload(body, 'banners', 'image/jpeg')).rejects.toThrow(
      'does not match',
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it('bounds a streamed response even without Content-Length', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES));
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(stream, { headers: { 'content-type': 'image/png' } }),
      );
    await expect(service.importRemote(source)).rejects.toThrow('exceeds 8 MiB');
    expect(upload).not.toHaveBeenCalled();
  });
});

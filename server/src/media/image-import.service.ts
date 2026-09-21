import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { MediaStorageService } from './media-storage.service';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_CATEGORIES = ['banners', 'pictures', 'assets'] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

const REMOTE_HOSTS = new Set([
  'i.postimg.cc',
  'shared.akamai.steamstatic.com',
  'cdn.akamai.steamstatic.com',
  'cdn.cloudflare.steamstatic.com',
]);
const FORMATS = {
  jpeg: { extension: 'jpg', contentType: 'image/jpeg' },
  png: { extension: 'png', contentType: 'image/png' },
  gif: { extension: 'gif', contentType: 'image/gif' },
  webp: { extension: 'webp', contentType: 'image/webp' },
};

@Injectable()
export class ImageImportService {
  constructor(private readonly storage: MediaStorageService) {}

  async importRemote(sourceUrl: string, category: ImageCategory = 'banners') {
    this.assertConfigured();
    let source: URL;
    try {
      source = new URL(sourceUrl);
    } catch {
      throw new BadRequestException('Invalid image URL.');
    }
    if (
      source.protocol !== 'https:' ||
      source.username ||
      source.password ||
      source.port ||
      !REMOTE_HOSTS.has(source.hostname)
    ) {
      throw new BadRequestException(
        'Import a direct HTTPS image from Postimages or Steam, or upload a local file.',
      );
    }

    const response = await this.fetchImage(source.href);
    const body = await this.readImageResponse(response);
    return this.upload(body, category, this.contentType(response));
  }

  async upload(
    body: Uint8Array,
    category: ImageCategory = 'banners',
    declaredType?: string,
  ) {
    this.assertConfigured();
    if (!IMAGE_CATEGORIES.includes(category)) {
      throw new BadRequestException('Invalid image category.');
    }
    if (!body.byteLength || body.byteLength > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Images must be between 1 byte and 8 MiB.');
    }

    const image = sharp(body, { limitInputPixels: 20_000_000, animated: true });
    const metadata = await image.metadata().catch(() => {
      throw new BadRequestException('Invalid or oversized image.');
    });
    const format = FORMATS[metadata.format as keyof typeof FORMATS];
    if (!format || !metadata.width || !metadata.height) {
      throw new BadRequestException(
        'Only PNG, JPEG, GIF, and WebP are supported.',
      );
    }
    if (declaredType && declaredType !== format.contentType) {
      throw new BadRequestException(
        'Image content does not match its content type.',
      );
    }
    await image.stats().catch(() => {
      throw new BadRequestException('The image could not be decoded.');
    });

    const sha256 = this.checksum(body);
    const url = await this.storage.upload({
      category,
      objectName: `${sha256}.${format.extension}`,
      body,
      contentType: format.contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    });

    // Return a URL only after the publicly served bytes match the original.
    const publicResponse = await this.fetchImage(url);
    const publicBody = await this.readImageResponse(publicResponse);
    if (
      this.contentType(publicResponse) !== format.contentType ||
      this.checksum(publicBody) !== sha256
    ) {
      throw new BadGatewayException('The public R2 image failed verification.');
    }
    return {
      url,
      sha256,
      bytes: body.byteLength,
      contentType: format.contentType,
      width: metadata.width,
      height: metadata.pageHeight ?? metadata.height,
    };
  }

  private assertConfigured() {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException(
        'R2 media storage is not configured.',
      );
    }
  }

  private async fetchImage(url: string): Promise<Response> {
    try {
      return await fetch(url, {
        headers: { Accept: 'image/*' },
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException('The image could not be downloaded.');
    }
  }

  private async readImageResponse(response: Response): Promise<Uint8Array> {
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new BadGatewayException(
        `Image host returned HTTP ${response.status}.`,
      );
    }
    if (
      !Object.values(FORMATS).some(
        (f) => f.contentType === this.contentType(response),
      )
    ) {
      await response.body?.cancel();
      throw new BadGatewayException(
        'The image host returned an unsupported content type.',
      );
    }
    if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
      await response.body?.cancel();
      throw new BadRequestException('The remote image exceeds 8 MiB.');
    }
    if (!response.body) {
      throw new BadGatewayException('The image host returned an empty body.');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_IMAGE_BYTES) {
          throw new BadRequestException('The remote image exceeds 8 MiB.');
        }
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks, size);
  }

  private checksum(body: Uint8Array) {
    return createHash('sha256').update(body).digest('hex');
  }

  private contentType(response: Response) {
    return response.headers
      .get('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase();
  }
}

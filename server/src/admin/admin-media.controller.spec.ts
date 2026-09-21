import type { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  ImageImportService,
  MAX_IMAGE_BYTES,
} from '../media/image-import.service';
import { AdminMediaController } from './admin-media.controller';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';

describe('Admin media authorization and upload limits', () => {
  let app: INestApplication;
  const images = {
    upload: jest.fn().mockResolvedValue({ url: 'https://media.example/a.png' }),
    importRemote: jest
      .fn()
      .mockResolvedValue({ url: 'https://media.example/b.png' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminMediaController],
      providers: [
        AdminApiKeyGuard,
        {
          provide: ConfigService,
          useValue: new ConfigService({ MCP_ADMIN_TOKEN: 'test' }),
        },
        { provide: ImageImportService, useValue: images },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('rejects anonymous uploads and imports before invoking storage', async () => {
    await request(app.getHttpServer() as Server)
      .post('/admin/media/import')
      .send({ sourceUrl: 'https://i.postimg.cc/a.png' })
      .expect(401);
    await request(app.getHttpServer() as Server)
      .post('/admin/media/upload')
      .attach('file', Buffer.from('image'), 'image.png')
      .expect(401);
    expect(images.upload).not.toHaveBeenCalled();
    expect(images.importRemote).not.toHaveBeenCalled();
  });

  it('accepts an authorized multipart image and category', async () => {
    await request(app.getHttpServer() as Server)
      .post('/admin/media/upload')
      .auth('test', { type: 'bearer' })
      .field('category', 'banners')
      .attach('file', Buffer.from('image'), 'image.png')
      .expect(201);
    expect(images.upload).toHaveBeenCalledWith(
      Buffer.from('image'),
      'banners',
      'image/png',
    );
  });

  it('rejects oversized files and invalid categories before storage', async () => {
    await request(app.getHttpServer() as Server)
      .post('/admin/media/upload')
      .auth('test', { type: 'bearer' })
      .attach('file', Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image.png')
      .expect(413);
    await request(app.getHttpServer() as Server)
      .post('/admin/media/import')
      .auth('test', { type: 'bearer' })
      .send({ sourceUrl: 'https://i.postimg.cc/a.png', category: '../escape' })
      .expect(400);
    expect(images.upload).not.toHaveBeenCalled();
    expect(images.importRemote).not.toHaveBeenCalled();
  });
});

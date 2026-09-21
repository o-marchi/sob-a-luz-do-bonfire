import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsUrl } from 'class-validator';
import {
  IMAGE_CATEGORIES,
  ImageImportService,
  MAX_IMAGE_BYTES,
} from '../media/image-import.service';
import type { ImageCategory } from '../media/image-import.service';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';

class UploadImageDto {
  @IsOptional()
  @IsIn(IMAGE_CATEGORIES)
  category?: ImageCategory;
}

class ImportImageDto extends UploadImageDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  sourceUrl!: string;
}

@Controller('admin/media')
@UseGuards(AdminApiKeyGuard)
export class AdminMediaController {
  constructor(private readonly images: ImageImportService) {}

  @Post('import')
  importImage(@Body() body: ImportImageDto) {
    return this.images.importRemote(body.sourceUrl, body.category);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 1, parts: 3 },
    }),
  )
  uploadImage(
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @Body() body: UploadImageDto,
  ) {
    if (!file) throw new BadRequestException('An image file is required.');
    return this.images.upload(file.buffer, body.category, file.mimetype);
  }
}

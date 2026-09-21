import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaStorageService } from './media-storage.service';
import { ImageImportService } from './image-import.service';

@Module({
  imports: [ConfigModule],
  providers: [MediaStorageService, ImageImportService],
  exports: [MediaStorageService, ImageImportService],
})
export class MediaModule {}

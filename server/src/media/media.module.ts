import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaStorageService } from './media-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [MediaStorageService],
  exports: [MediaStorageService],
})
export class MediaModule {}

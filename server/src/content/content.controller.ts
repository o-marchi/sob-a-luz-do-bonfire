import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { SiteContent } from './entities/site-content.entity';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('rules')
  getRules(): Promise<SiteContent> {
    return this.contentService.getRules();
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { DEFAULT_RULES_MARKDOWN, RULES_CONTENT_KEY } from './default-rules';
import { SiteContent } from './entities/site-content.entity';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(SiteContent)
    private readonly contentRepository: Repository<SiteContent>,
  ) {}

  async getRules(): Promise<SiteContent> {
    const rules = await this.contentRepository.findOneBy({
      key: RULES_CONTENT_KEY,
    });

    if (rules) {
      return rules;
    }

    try {
      return await this.contentRepository.save(
        this.contentRepository.create({
          key: RULES_CONTENT_KEY,
          content: DEFAULT_RULES_MARKDOWN,
        }),
      );
    } catch (error: unknown) {
      const concurrentlyCreatedRules = await this.contentRepository.findOneBy({
        key: RULES_CONTENT_KEY,
      });

      if (concurrentlyCreatedRules) {
        return concurrentlyCreatedRules;
      }

      throw error;
    }
  }

  async updateRules(
    content: string,
    manager?: EntityManager,
  ): Promise<SiteContent> {
    const repository = manager
      ? manager.getRepository(SiteContent)
      : this.contentRepository;
    await repository.upsert(
      {
        key: RULES_CONTENT_KEY,
        content,
        updatedAt: new Date(),
      },
      ['key'],
    );

    return repository.findOneByOrFail({
      key: RULES_CONTENT_KEY,
    });
  }
}

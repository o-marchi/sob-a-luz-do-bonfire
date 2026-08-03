import { DataSource } from 'typeorm';
import { ContentService } from './content.service';
import { DEFAULT_RULES_MARKDOWN, RULES_CONTENT_KEY } from './default-rules';
import { SiteContent } from './entities/site-content.entity';

describe('ContentService', () => {
  let dataSource: DataSource;
  let service: ContentService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      entities: [SiteContent],
      synchronize: true,
    });
    await dataSource.initialize();
    service = new ContentService(dataSource.getRepository(SiteContent));
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('seeds the existing website rules when no database value exists', async () => {
    const rules = await service.getRules();

    expect(rules).toMatchObject({
      key: RULES_CONTENT_KEY,
      content: DEFAULT_RULES_MARKDOWN,
    });
    await expect(dataSource.getRepository(SiteContent).count()).resolves.toBe(
      1,
    );
  });

  it('updates and persists the website rules', async () => {
    await service.getRules();
    await dataSource.query('UPDATE site_content SET updated_at = ?', [
      '2000-01-01 00:00:00',
    ]);

    const updatedRules = await service.updateRules('# Regras atualizadas');

    expect(updatedRules).toMatchObject({
      key: RULES_CONTENT_KEY,
      content: '# Regras atualizadas',
    });
    expect(updatedRules.updatedAt.getUTCFullYear()).toBeGreaterThan(2000);
    await expect(dataSource.getRepository(SiteContent).count()).resolves.toBe(
      1,
    );
  });
});

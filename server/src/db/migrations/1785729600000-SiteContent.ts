import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DEFAULT_RULES_MARKDOWN,
  RULES_CONTENT_KEY,
} from '../../content/default-rules';

export class SiteContent1785729600000 implements MigrationInterface {
  name = 'SiteContent1785729600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "site_content" (
        "key" character varying(100) NOT NULL,
        "content" text NOT NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_site_content" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(
      `INSERT INTO "site_content" ("key", "content")
       VALUES ($1, $2)
       ON CONFLICT ("key") DO NOTHING`,
      [RULES_CONTENT_KEY, DEFAULT_RULES_MARKDOWN],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "site_content"`);
  }
}

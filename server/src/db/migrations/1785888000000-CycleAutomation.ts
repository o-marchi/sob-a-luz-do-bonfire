import { MigrationInterface, QueryRunner } from 'typeorm';

export class CycleAutomation1785888000000 implements MigrationInterface {
  name = 'CycleAutomation1785888000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "election_started_at" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "election_ends_at" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "election_closed_at" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "research_checked_at" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN IF NOT EXISTS "research_status" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games" DROP COLUMN IF EXISTS "research_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" DROP COLUMN IF EXISTS "research_checked_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "election_closed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "election_ends_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "election_started_at"`,
    );
  }
}

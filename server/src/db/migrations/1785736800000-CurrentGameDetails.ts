import { MigrationInterface, QueryRunner } from 'typeorm';

export class CurrentGameDetails1785736800000 implements MigrationInterface {
  name = 'CurrentGameDetails1785736800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN "summary" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN "how_long_to_beat_url" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN "duration_label" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN "meeting_at" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN "meeting_location" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD COLUMN "meeting_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN "meeting_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN "meeting_location"`,
    );
    await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "meeting_at"`);
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "duration_label"`);
    await queryRunner.query(
      `ALTER TABLE "games" DROP COLUMN "how_long_to_beat_url"`,
    );
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "summary"`);
  }
}

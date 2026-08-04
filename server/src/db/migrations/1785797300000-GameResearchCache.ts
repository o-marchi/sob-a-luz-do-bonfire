import { MigrationInterface, QueryRunner } from 'typeorm';

export class GameResearchCache1785797300000 implements MigrationInterface {
  name = 'GameResearchCache1785797300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN "main_hours" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN "main_extra_hours" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ADD COLUMN "how_long_to_beat_title" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games" DROP COLUMN "how_long_to_beat_title"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" DROP COLUMN "main_extra_hours"`,
    );
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "main_hours"`);
  }
}

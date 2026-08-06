import { MigrationInterface, QueryRunner } from 'typeorm';

const SILENT_HILL_F_TRAILER = 'https://www.youtube.com/watch?v=0OqTeE3y1x0';

export class NavigableTrailerLinks1785974400000 implements MigrationInterface {
  name = 'NavigableTrailerLinks1785974400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "games" SET "trailer" = NULL WHERE LOWER("trailer") LIKE '%.m3u8%'`,
    );
    await queryRunner.query(
      `UPDATE "games" SET "trailer" = $1 WHERE "steam" LIKE '%store.steampowered.com/app/2947440/%'`,
      [SILENT_HILL_F_TRAILER],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "games" SET "trailer" = NULL WHERE "steam" LIKE '%store.steampowered.com/app/2947440/%' AND "trailer" = $1`,
      [SILENT_HILL_F_TRAILER],
    );
  }
}

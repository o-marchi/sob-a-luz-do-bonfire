import { MigrationInterface, QueryRunner } from 'typeorm';

export class GameRecommendationRegistry1785796200000
  implements MigrationInterface
{
  name = 'GameRecommendationRegistry1785796200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "game_recommendations" (
        "id" SERIAL NOT NULL,
        "game_id" integer NOT NULL,
        "player_id" integer NOT NULL,
        CONSTRAINT "UQ_game_recommendations_game_player" UNIQUE ("game_id", "player_id"),
        CONSTRAINT "PK_game_recommendations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_game_recommendations_game" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_recommendations_player" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "game_recommendations" ("game_id", "player_id")
      SELECT DISTINCT "suggested_game_id", "player_id"
      FROM "campaign_players"
      WHERE "suggested_game_id" IS NOT NULL
      ON CONFLICT ("game_id", "player_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "game_recommendations"`);
  }
}

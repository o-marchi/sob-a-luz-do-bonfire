import { MigrationInterface, QueryRunner } from 'typeorm';

export class GameRecommendations1785795104186 implements MigrationInterface {
  name = 'GameRecommendations1785795104186';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign_players" ADD COLUMN "suggested_game_id" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_campaign_players_suggested_game" ON "campaign_players" ("suggested_game_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "campaign_players" ADD CONSTRAINT "FK_campaign_players_suggested_game" FOREIGN KEY ("suggested_game_id") REFERENCES "games"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaign_players" DROP CONSTRAINT "FK_campaign_players_suggested_game"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_campaign_players_suggested_game"`);
    await queryRunner.query(
      `ALTER TABLE "campaign_players" DROP COLUMN "suggested_game_id"`,
    );
  }
}

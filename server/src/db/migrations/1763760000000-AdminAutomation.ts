import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminAutomation1763760000000 implements MigrationInterface {
  name = 'AdminAutomation1763760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
        "id" SERIAL NOT NULL,
        "action" character varying NOT NULL,
        "actor" character varying NOT NULL DEFAULT 'mcp',
        "payload" jsonb,
        "result" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_audit_logs" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);
  }
}

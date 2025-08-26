import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "campaigns_election_election_options_voters" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"player_id" integer
  );
  
  CREATE TABLE "campaigns_election_election_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"game_id" integer NOT NULL,
  	"tokens" numeric
  );
  
  ALTER TABLE "games" ADD COLUMN "steam" varchar;
  ALTER TABLE "games" ADD COLUMN "trailer" varchar;
  ALTER TABLE "campaigns" ADD COLUMN "election_active" boolean DEFAULT false;
  ALTER TABLE "campaigns_election_election_options_voters" ADD CONSTRAINT "campaigns_election_election_options_voters_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaigns_election_election_options_voters" ADD CONSTRAINT "campaigns_election_election_options_voters_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaigns_election_election_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaigns_election_election_options" ADD CONSTRAINT "campaigns_election_election_options_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaigns_election_election_options" ADD CONSTRAINT "campaigns_election_election_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "campaigns_election_election_options_voters_order_idx" ON "campaigns_election_election_options_voters" USING btree ("_order");
  CREATE INDEX "campaigns_election_election_options_voters_parent_id_idx" ON "campaigns_election_election_options_voters" USING btree ("_parent_id");
  CREATE INDEX "campaigns_election_election_options_voters_player_idx" ON "campaigns_election_election_options_voters" USING btree ("player_id");
  CREATE INDEX "campaigns_election_election_options_order_idx" ON "campaigns_election_election_options" USING btree ("_order");
  CREATE INDEX "campaigns_election_election_options_parent_id_idx" ON "campaigns_election_election_options" USING btree ("_parent_id");
  CREATE INDEX "campaigns_election_election_options_game_idx" ON "campaigns_election_election_options" USING btree ("game_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "campaigns_election_election_options_voters" CASCADE;
  DROP TABLE "campaigns_election_election_options" CASCADE;
  ALTER TABLE "games" DROP COLUMN "steam";
  ALTER TABLE "games" DROP COLUMN "trailer";
  ALTER TABLE "campaigns" DROP COLUMN "election_active";`)
}

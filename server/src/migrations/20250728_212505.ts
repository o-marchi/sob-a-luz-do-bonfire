import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "games" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"cover_id" integer,
  	"suggestion" boolean,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "campaigns_players" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"player_id" integer NOT NULL,
  	"played_the_game" boolean DEFAULT false,
  	"finished_the_game" boolean DEFAULT false,
  	"suggested_a_game" varchar,
  	"partook_in_the_meeting" boolean DEFAULT false,
  	"tokens" numeric
  );
  
  CREATE TABLE "campaigns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"month" varchar NOT NULL,
  	"year" varchar,
  	"current" boolean DEFAULT false,
  	"hero_description" jsonb,
  	"game_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "players" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"discord_discord_id" varchar,
  	"discord_username" varchar,
  	"discord_global_name" varchar,
  	"discord_avatar" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "games_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaigns_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "players_id" integer;
  ALTER TABLE "games" ADD CONSTRAINT "games_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaigns_players" ADD CONSTRAINT "campaigns_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaigns_players" ADD CONSTRAINT "campaigns_players_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "games_cover_idx" ON "games" USING btree ("cover_id");
  CREATE INDEX "games_updated_at_idx" ON "games" USING btree ("updated_at");
  CREATE INDEX "games_created_at_idx" ON "games" USING btree ("created_at");
  CREATE INDEX "campaigns_players_order_idx" ON "campaigns_players" USING btree ("_order");
  CREATE INDEX "campaigns_players_parent_id_idx" ON "campaigns_players" USING btree ("_parent_id");
  CREATE INDEX "campaigns_players_player_idx" ON "campaigns_players" USING btree ("player_id");
  CREATE INDEX "campaigns_game_idx" ON "campaigns" USING btree ("game_id");
  CREATE INDEX "campaigns_updated_at_idx" ON "campaigns" USING btree ("updated_at");
  CREATE INDEX "campaigns_created_at_idx" ON "campaigns" USING btree ("created_at");
  CREATE INDEX "players_updated_at_idx" ON "players" USING btree ("updated_at");
  CREATE INDEX "players_created_at_idx" ON "players" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_games_fk" FOREIGN KEY ("games_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaigns_fk" FOREIGN KEY ("campaigns_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_players_fk" FOREIGN KEY ("players_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_games_id_idx" ON "payload_locked_documents_rels" USING btree ("games_id");
  CREATE INDEX "payload_locked_documents_rels_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("campaigns_id");
  CREATE INDEX "payload_locked_documents_rels_players_id_idx" ON "payload_locked_documents_rels" USING btree ("players_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "games" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaigns_players" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaigns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "players" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "media" CASCADE;
  DROP TABLE "games" CASCADE;
  DROP TABLE "campaigns_players" CASCADE;
  DROP TABLE "campaigns" CASCADE;
  DROP TABLE "players" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_games_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_campaigns_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_players_fk";
  
  DROP INDEX "payload_locked_documents_rels_media_id_idx";
  DROP INDEX "payload_locked_documents_rels_games_id_idx";
  DROP INDEX "payload_locked_documents_rels_campaigns_id_idx";
  DROP INDEX "payload_locked_documents_rels_players_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "games_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaigns_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "players_id";`)
}

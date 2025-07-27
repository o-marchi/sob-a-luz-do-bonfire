import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  if (db && !db.run) {
    db.run = db.query
  }

  await db.run(sql`CREATE TABLE \`users_sessions\`
                   (
                     \`_order\`     integer          NOT NULL,
                     \`_parent_id\` integer          NOT NULL,
                     \`id\`         text PRIMARY KEY NOT NULL,
                     \`created_at\` text,
                     \`expires_at\` text             NOT NULL,
                     FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE no action ON DELETE cascade
                   );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(
    sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`users\`
                   (
                     \`id\`                        integer PRIMARY KEY                                     NOT NULL,
                     \`name\`                      text,
                     \`updated_at\`                text    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`created_at\`                text    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`email\`                     text                                                    NOT NULL,
                     \`reset_password_token\`      text,
                     \`reset_password_expiration\` text,
                     \`salt\`                      text,
                     \`hash\`                      text,
                     \`login_attempts\`            numeric DEFAULT 0,
                     \`lock_until\`                text
                   );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`media\`
                   (
                     \`id\`              integer PRIMARY KEY                                  NOT NULL,
                     \`alt\`             text                                                 NOT NULL,
                     \`updated_at\`      text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`created_at\`      text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`url\`             text,
                     \`thumbnail_u_r_l\` text,
                     \`filename\`        text,
                     \`mime_type\`       text,
                     \`filesize\`        numeric,
                     \`width\`           numeric,
                     \`height\`          numeric,
                     \`focal_x\`         numeric,
                     \`focal_y\`         numeric
                   );
  `)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`games\`
                   (
                     \`id\`         integer PRIMARY KEY                                  NOT NULL,
                     \`title\`      text                                                 NOT NULL,
                     \`cover_id\`   integer,
                     \`suggestion\` integer,
                     \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     FOREIGN KEY (\`cover_id\`) REFERENCES \`media\` (\`id\`) ON UPDATE no action ON DELETE set null
                   );
  `)
  await db.run(sql`CREATE INDEX \`games_cover_idx\` ON \`games\` (\`cover_id\`);`)
  await db.run(sql`CREATE INDEX \`games_updated_at_idx\` ON \`games\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`games_created_at_idx\` ON \`games\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`campaigns_players\`
                   (
                     \`_order\`                 integer          NOT NULL,
                     \`_parent_id\`             integer          NOT NULL,
                     \`id\`                     text PRIMARY KEY NOT NULL,
                     \`player_id\`              integer          NOT NULL,
                     \`played_the_game\`        integer DEFAULT false,
                     \`finished_the_game\`      integer DEFAULT false,
                     \`suggested_a_game\`       text,
                     \`partook_in_the_meeting\` integer DEFAULT false,
                     \`tokens\`                 numeric,
                     FOREIGN KEY (\`player_id\`) REFERENCES \`players\` (\`id\`) ON UPDATE no action ON DELETE set null,
                     FOREIGN KEY (\`_parent_id\`) REFERENCES \`campaigns\` (\`id\`) ON UPDATE no action ON DELETE cascade
                   );
  `)
  await db.run(
    sql`CREATE INDEX \`campaigns_players_order_idx\` ON \`campaigns_players\` (\`_order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`campaigns_players_parent_id_idx\` ON \`campaigns_players\` (\`_parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`campaigns_players_player_idx\` ON \`campaigns_players\` (\`player_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`campaigns\`
                   (
                     \`id\`               integer PRIMARY KEY                                     NOT NULL,
                     \`month\`            text                                                    NOT NULL,
                     \`year\`             text,
                     \`current\`          integer DEFAULT false,
                     \`hero_description\` text,
                     \`game_id\`          integer,
                     \`updated_at\`       text    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`created_at\`       text    DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     FOREIGN KEY (\`game_id\`) REFERENCES \`games\` (\`id\`) ON UPDATE no action ON DELETE set null
                   );
  `)
  await db.run(sql`CREATE INDEX \`campaigns_game_idx\` ON \`campaigns\` (\`game_id\`);`)
  await db.run(sql`CREATE INDEX \`campaigns_updated_at_idx\` ON \`campaigns\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`campaigns_created_at_idx\` ON \`campaigns\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`players\`
                   (
                     \`id\`                  integer PRIMARY KEY                                  NOT NULL,
                     \`email\`               text                                                 NOT NULL,
                     \`name\`                text,
                     \`discord_discord_id\`  text,
                     \`discord_username\`    text,
                     \`discord_global_name\` text,
                     \`discord_avatar\`      text,
                     \`updated_at\`          text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`created_at\`          text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
                   );
  `)
  await db.run(sql`CREATE INDEX \`players_updated_at_idx\` ON \`players\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`players_created_at_idx\` ON \`players\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\`
                   (
                     \`id\`          integer PRIMARY KEY                                  NOT NULL,
                     \`global_slug\` text,
                     \`updated_at\`  text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`created_at\`  text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
                   );
  `)
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`,
  )
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\`
                   (
                     \`id\`           integer PRIMARY KEY NOT NULL,
                     \`order\`        integer,
                     \`parent_id\`    integer             NOT NULL,
                     \`path\`         text                NOT NULL,
                     \`users_id\`     integer,
                     \`media_id\`     integer,
                     \`games_id\`     integer,
                     \`campaigns_id\` integer,
                     \`players_id\`   integer,
                     FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\` (\`id\`) ON UPDATE no action ON DELETE cascade,
                     FOREIGN KEY (\`users_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE no action ON DELETE cascade,
                     FOREIGN KEY (\`media_id\`) REFERENCES \`media\` (\`id\`) ON UPDATE no action ON DELETE cascade,
                     FOREIGN KEY (\`games_id\`) REFERENCES \`games\` (\`id\`) ON UPDATE no action ON DELETE cascade,
                     FOREIGN KEY (\`campaigns_id\`) REFERENCES \`campaigns\` (\`id\`) ON UPDATE no action ON DELETE cascade,
                     FOREIGN KEY (\`players_id\`) REFERENCES \`players\` (\`id\`) ON UPDATE no action ON DELETE cascade
                   );
  `)
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_games_id_idx\` ON \`payload_locked_documents_rels\` (\`games_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_campaigns_id_idx\` ON \`payload_locked_documents_rels\` (\`campaigns_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_locked_documents_rels_players_id_idx\` ON \`payload_locked_documents_rels\` (\`players_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`payload_preferences\`
                   (
                     \`id\`         integer PRIMARY KEY                                  NOT NULL,
                     \`key\`        text,
                     \`value\`      text,
                     \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
                   );
  `)
  await db.run(
    sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`,
  )
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\`
                   (
                     \`id\`        integer PRIMARY KEY NOT NULL,
                     \`order\`     integer,
                     \`parent_id\` integer             NOT NULL,
                     \`path\`      text                NOT NULL,
                     \`users_id\`  integer,
                     FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\` (\`id\`) ON UPDATE no action ON DELETE cascade,
                     FOREIGN KEY (\`users_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE no action ON DELETE cascade
                   );
  `)
  await db.run(
    sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`,
  )
  await db.run(sql`CREATE TABLE \`payload_migrations\`
                   (
                     \`id\`         integer PRIMARY KEY                                  NOT NULL,
                     \`name\`       text,
                     \`batch\`      numeric,
                     \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
                     \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
                   );
  `)
  await db.run(
    sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`,
  )
  await db.run(
    sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  if (db && !db.run) {
    db.run = db.query
  }
  
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`games\`;`)
  await db.run(sql`DROP TABLE \`campaigns_players\`;`)
  await db.run(sql`DROP TABLE \`campaigns\`;`)
  await db.run(sql`DROP TABLE \`players\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
}

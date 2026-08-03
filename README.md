# Sob a Luz do Bonfire

A full-stack web app for managing the **Sob a Luz do Bonfire** game club: current campaigns, past campaigns, game information, Discord login, player progress, and voting/election flow for upcoming games.

The repository is split into three workspace packages:

- `client/` — Vue 3 + Vite + TypeScript frontend.
- `server/` — NestJS + TypeORM API backed by PostgreSQL.
- `mcp/` — MCP server for guarded monthly administration workflows.

## Tech stack

### Frontend

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Router
- Naive UI
- Axios
- Vitest
- Markdown rendering for campaign/rules content

### Backend

- NestJS 11
- TypeScript
- TypeORM
- PostgreSQL for production/source data
- SQL.js/SQLite file for local development
- Passport JWT
- Discord OAuth
- Swagger/OpenAPI
- Jest
- Docker Compose for local PostgreSQL

## Main features

- View the current game campaign.
- View campaign history.
- Render database-backed rules and campaign descriptions from Markdown.
- Login with Discord.
- Track whether an authenticated player started or finished the current game.
- Vote and undo votes in campaign election pools.
- Manage games, campaigns, players, users, and pools through API endpoints.

## Project structure

```text
.
├── .github/workflows/       # CI workflow
├── client/                  # Vue/Vite app
│   ├── src/components/      # Shared Vue components
│   ├── src/views/           # Routed pages
│   ├── src/services/        # API service wrappers and tests
│   ├── src/stores/          # Pinia stores
│   └── src/types/           # Frontend TypeScript types
├── server/                  # NestJS API
│   ├── src/auth/            # Discord OAuth and JWT auth
│   ├── src/campaign/        # Campaign logic and voting endpoints
│   ├── src/content/         # Public, database-backed website content
│   ├── src/games/           # Game CRUD
│   ├── src/players/         # Player CRUD/profile logic
│   ├── src/pool/            # Election pool logic
│   ├── src/users/           # User CRUD
│   └── src/db/migrations/   # TypeORM migrations
├── mcp/                     # MCP tools backed by the admin API
├── package.json             # Root pnpm workspace scripts
├── pnpm-lock.yaml           # Workspace lockfile
├── pnpm-workspace.yaml      # pnpm workspace definition
└── README.md
```

## Prerequisites

- Node.js `22.x`
- pnpm `10.x`
- Docker + Docker Compose, for the local PostgreSQL database
- A Discord application for OAuth login

If needed, enable pnpm through Corepack:

```sh
corepack enable
corepack prepare pnpm@10.29.3 --activate
```

## Environment variables

Example files are included:

- `client/.env.example`
- `server/.env.example`

Create local env files from them:

```sh
cp client/.env.example client/.env
cp server/.env.example server/.env
```

### Client

```env
VITE_API_URL=http://localhost:3000
```

### Server

```env
PORT=3000
NODE_ENV=development

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_NAME=sobaluz

PUBLIC_CLIENT_URL=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret

DISCORD_CLIENT_ID=replace-with-discord-client-id
DISCORD_CLIENT_SECRET=replace-with-discord-client-secret
DISCORD_CALLBACK_URL=http://localhost:3000/auth/discord/callback
```

In the Discord Developer Portal, configure the OAuth redirect URL to match `DISCORD_CALLBACK_URL`.

## Getting started

From the repository root:

```sh
pnpm install
pnpm run db:sync:prod
pnpm run dev
```

Then open:

- Frontend: <http://localhost:5173>
- API: <http://localhost:3000>
- API docs: <http://localhost:3000/docs>
- OpenAPI JSON: <http://localhost:3000/docs-json>

The root `dev` command starts both apps. You can also run each side separately:

```sh
pnpm run dev:client
pnpm run dev:server
```

## Useful commands

All commands below are available from the repository root.

| Command | Description |
| --- | --- |
| `pnpm install` | Install all workspace dependencies. |
| `pnpm run install:all` | Alias for `pnpm install`. |
| `pnpm run db:sync:prod` | Copy production Postgres data into the local SQL.js/SQLite file. |
| `pnpm run db:up` | Start local PostgreSQL with Docker Compose, if you choose to use Postgres locally. |
| `pnpm run db:down` | Stop local PostgreSQL. |
| `pnpm run dev` | Start server watch mode and Vite dev server. |
| `pnpm run dev:client` | Start only the frontend. |
| `pnpm run dev:server` | Start only the API in watch mode. |
| `pnpm run build` | Build frontend, backend, and MCP server. |
| `pnpm run build:mcp` | Build only the MCP server. |
| `pnpm run type-check` | Run Vue TypeScript checks. |
| `pnpm run lint` | Check server source with ESLint. |
| `pnpm run format` | Format client and server source files. |
| `pnpm run test` | Run client and server tests. |
| `pnpm run test:client` | Run only client tests. |
| `pnpm run test:server` | Run only server tests. |
| `pnpm run test:cov` | Run server tests with coverage. |
| `pnpm run preview:client` | Preview the built frontend. |
| `pnpm run start:server:prod` | Run the built NestJS server. |
| `pnpm run ci` | Run type-check, lint, build, and tests locally. |

## API overview

Swagger UI is available at `/docs` when the server is running.

The server exposes routes for:

- `GET /campaign/current` — current campaign, optionally enriched with authenticated player data.
- `GET /campaign/history` — campaign history.
- `GET /content/rules` — Markdown rules currently published on the website.
- `PUT /campaign/update-player-game-information` — update authenticated player's current campaign progress.
- `POST /campaign/vote` and `POST /campaign/undo-vote` — campaign voting actions.
- `GET /auth/discord` — start Discord OAuth flow.
- `GET /auth/discord/callback` — Discord OAuth callback.
- CRUD-style routes under `/campaign`, `/games`, `/players`, `/pool`, and `/users`.

The MCP/admin API also exposes guarded `GET /admin/rules` and
`PATCH /admin/rules` endpoints. The `get_rules` and `update_rules` MCP tools use
these endpoints so the published Markdown can be reviewed and changed without a
code deployment.

## Testing

- Client tests use Vitest and live alongside frontend source files.
- Server tests use Jest and match `server/src/**/*.spec.ts`.

Run everything:

```sh
pnpm run test
```

## Database

Local development defaults to a SQL.js/SQLite file so you do not need to run a database server.

Configure `server/.env` like this:

```env
DATABASE_TYPE=sqljs
DATABASE_SQLITE_PATH=data/local.sqlite
PRODUCTION_DATABASE_URI=postgresql://user:password@host:5432/database
PRODUCTION_DATABASE_SSL=true
```

Then create or refresh the local database from production:

```sh
pnpm run db:sync:prod
```

The generated SQLite file lives at `server/data/local.sqlite` by default and is ignored by Git.

Website rules are stored in the `site_content` table under the `rules` key. The
initial migration preserves the rules that were previously bundled with the
frontend, and later updates take effect as soon as the Rules page is refreshed.

PostgreSQL is still available for local development through `server/docker-compose.yml` if needed:

- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `password`
- Database: `sobaluz`

Unset `DATABASE_TYPE` or set it to `postgres` to use the Postgres configuration instead.

## CI

GitHub Actions runs on pull requests and pushes to `develop` and `master`:

1. Install dependencies with pnpm.
2. Run frontend type-checking and server linting.
3. Build client, server, and MCP packages.
4. Run client and server tests.

## Recommended next steps

- Add more client component/store tests and server controller tests.
- Add DTO/entity Swagger decorators for richer request/response schemas in `/docs`.
- Add route guards/authorization for admin-like CRUD endpoints if those should not be public.
- Review production security settings, especially CORS, JWT secret handling, database migrations, and which endpoints require authentication.

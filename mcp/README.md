# Sob a Luz do Bonfire MCP

MCP server for safe monthly admin workflows:

- add/update games
- create/reuse pools
- attach pools to campaigns
- update campaign descriptions and election state
- bulk update meeting participation and game-completion flags
- calculate/finalize elections

The MCP talks to the NestJS admin API. It does **not** write directly to Postgres.

## Local setup

1. Configure the deployed API server with an admin token:

```env
MCP_ADMIN_TOKEN=replace-with-a-long-random-secret
```

`ADMIN_API_TOKEN` is also accepted by the API as a fallback.

2. Install and build the MCP package locally:

```sh
cd mcp
npm install
npm run build
```

3. Configure Zed or another MCP client to launch the local stdio server:

```json
{
  "context_servers": {
    "sob-a-luz-do-bonfire": {
      "command": "node",
      "args": ["/absolute/path/to/sob-a-luz-do-bonfire/mcp/dist/index.js"],
      "env": {
        "SOBALUZ_API_BASE_URL": "https://your-railway-server.up.railway.app",
        "SOBALUZ_ADMIN_TOKEN": "replace-with-the-same-token"
      }
    }
  }
}
```

## Safest monthly flow

1. Ask the agent to prepare a monthly plan.
2. The agent calls `preview_monthly_plan`.
3. Review the returned actions/warnings/errors.
4. If it looks right, explicitly approve.
5. The agent calls `apply_monthly_plan` with the preview `confirmationToken`.

## Example `preview_monthly_plan` input

```json
{
  "campaign": {
    "id": 1,
    "description": "Markdown for the month",
    "electionActive": true
  },
  "games": [
    {
      "title": "Hades",
      "steam": "https://store.steampowered.com/app/1145360/Hades/"
    },
    {
      "title": "Outer Wilds"
    }
  ],
  "pool": {
    "gameTitles": ["Hades", "Outer Wilds"],
    "attachToCampaign": true
  },
  "participants": [
    {
      "player": { "name": "Onelio" },
      "partook_in_the_meeting": true,
      "played_the_game": true,
      "finished_the_game": false,
      "suggested_a_game": false
    }
  ]
}
```

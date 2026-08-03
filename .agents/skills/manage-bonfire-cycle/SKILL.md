---
name: manage-bonfire-cycle
description: Operate the Sob a Luz do Bonfire monthly campaign cycle through the repository MCP and admin API. Use when creating or updating campaigns, creating election pools, attaching a pool to a campaign, enabling or closing an election, assigning a winning game, changing the current campaign, recording meeting attendance or game recommendations, updating played/finished flags, checking backlog election eligibility, or finalizing an election.
---

# Manage Bonfire Cycle

Use the repository MCP as the production write boundary. Never mutate production tables directly.

## Preflight

1. Work from the repository root.
2. Read `mcp/README.md` if the Sob a Luz MCP tools are unavailable or unconfigured.
3. Call `get_admin_state` or `get_current_campaign` before planning changes.
4. Resolve existing games with `list_games` and people with `list_players`.
5. Never create a player unless the user explicitly asks for a new player. Set `createIfMissing: false` or omit it for normal cycle work.

## Mutation workflow

Prefer one transactional monthly plan when a request combines games, a pool, campaign fields, or participants:

1. Build the smallest plan that represents the request.
2. Call `preview_monthly_plan`.
3. Inspect every action, warning, and error.
4. Apply with `apply_monthly_plan`, `confirm: true`, and the returned token only when the preview is exact and clean.
5. Read back the campaign and report the resulting IDs, game titles, election state, and participant flags.

A direct imperative request to create or update the described records authorizes an exact clean preview. Ask again before applying when the preview contains warnings, ambiguity, a tie, player creation, data removal, a current-campaign transition the user did not request, or any extra action.

Use the narrower MCP tools only for isolated operations. Still read state first and read back after writing.

## Domain rules

- `electionActive` is the election switch on the campaign. A pool itself has no active flag.
- A recommended game must have Main + Extras of at most 20 hours on HowLongToBeat.
- A backlog game is eligible when it has never won and has appeared in fewer than three prior election pools.
- After three unsuccessful appearances, exclude it until a participant explicitly recommends it again in a later meeting.
- A game that already won a campaign is not backlog-eligible.
- Mark only actual recommenders with `suggested_a_game: true`. When the game is known, also provide exactly one of `suggestedGameId` or `suggestedGameTitle`; the game reference automatically implies the boolean. Preserve legacy boolean-only records when the title is unknown.
- Use top-level `recommendations` for verified historical game-to-person provenance when the original campaign is unknown. Do not invent a campaign association merely to populate a game's recommender list.
- Mark only actual attendees with `partook_in_the_meeting: true`.
- Preserve unrelated participant flags by omitting them from updates.
- Use Portuguese for campaign announcements unless the user requests another language.

Read [references/workflows.md](references/workflows.md) for tool payloads and cycle-specific procedures.

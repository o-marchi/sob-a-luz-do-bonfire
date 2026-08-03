# Campaign Workflows

## Tool selection

| Task                             | Preferred tool                                    |
| -------------------------------- | ------------------------------------------------- |
| Read current state               | `get_admin_state`, `get_current_campaign`         |
| Resolve records                  | `list_games`, `list_players`                      |
| Combined monthly change          | `preview_monthly_plan`, then `apply_monthly_plan` |
| Standalone game upsert           | `upsert_games`                                    |
| Standalone pool creation         | `create_pool_from_games`                          |
| Attach existing pool             | `attach_pool_to_campaign`                         |
| Campaign-only update             | `update_campaign`                                 |
| Attendance and participant flags | `bulk_update_campaign_participants`               |
| Read election totals             | `get_election_result`                             |
| Assign winner and close voting   | `finalize_election`                               |

## Monthly plan shape

```json
{
  "campaign": {
    "id": 16,
    "description": "Markdown in Portuguese",
    "meetingAt": "2026-08-27T20:00:00-03:00",
    "meetingLocation": "Discord",
    "meetingUrl": "https://discord.com/events/example",
    "electionActive": true
  },
  "games": [
    {
      "title": "Example Game",
      "cover": "https://example.com/banner.jpg",
      "suggestion": true,
      "steam": "https://store.steampowered.com/app/123/Example/",
      "trailer": "https://www.youtube.com/watch?v=example",
      "summary": "Resumo curto para o destaque do jogo atual.",
      "howLongToBeatUrl": "https://howlongtobeat.com/game/example",
      "durationLabel": "11 a 18 horas"
    }
  ],
  "pool": {
    "gameTitles": ["Example Game", "Existing Game"],
    "attachToCampaign": true
  },
  "participants": [
    {
      "player": { "name": "Existing Player" },
      "partook_in_the_meeting": true,
      "suggestedGameTitle": "Example Game"
    }
  ],
  "recommendations": [
    {
      "player": { "name": "Existing Player" },
      "gameTitle": "Older Recommendation"
    }
  ]
}
```

Omit fields that should remain unchanged. Use IDs after resolution when names are ambiguous. `suggestedGameId` or `suggestedGameTitle` automatically sets `suggested_a_game: true`; use the boolean alone only when the historical game is unknown.

Top-level `recommendations` records verified game-to-person provenance without claiming it happened in the selected campaign. Use this for historical backfills whose original meeting is unknown.

## Start an election

1. Resolve or research every proposed game.
2. Count historical pool appearances for backlog candidates.
3. Exclude prior winners and candidates with three unsuccessful appearances unless explicitly re-recommended this meeting.
4. Upsert only genuinely new or changed games.
5. Create or reuse one pool containing exactly the requested titles.
6. Attach it to the intended campaign and set `electionActive: true`.
7. Record attendees and recommenders without creating players.
8. Preview, apply, then verify the current campaign pool options.

## Finalize an election

1. Call `get_election_result` and report token totals.
2. Do not break a tie silently. Ask the user or use `allowTie` only when explicitly approved.
3. Call `finalize_election`; verify the game assignment and `electionActive: false`.
4. Prepare the next campaign description separately. Do not set it current until requested.

## Move to the next campaign

1. Create the next month/year campaign with the winning game and description.
2. Leave it non-current when the user asks to prepare it in advance.
3. When the user asks to switch, set the new campaign current and verify that the previous campaign is no longer current.
4. Do not copy the previous pool into the new campaign unless requested.

## Announcement description

Use concise Portuguese Markdown:

```markdown
Com N tokens, o jogo do mes de MES e:
**GAME**

Uma frase curta sobre o jogo ou a proposta do grupo.

[Steam](URL)
[Trailer](URL)
[HowLongToBeat](URL) X ~ Y horas

---

O nosso proximo encontro sera ...

[Link para o evento](URL)
```

Include rule changes only when they changed for that cycle.

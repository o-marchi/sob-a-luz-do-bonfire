# Game Record

## Database fields

```json
{
  "title": "Canonical Game Title",
  "cover": "https://example.com/header.jpg",
  "suggestion": true,
  "steam": "https://store.steampowered.com/app/123456/Game/",
  "trailer": "https://www.youtube.com/watch?v=example"
}
```

HowLongToBeat data is used for eligibility and campaign copy but is not stored on the `games` table.

## Duplicate resolution

Treat normalized title or the same Steam app ID as a likely duplicate. Prefer updating the existing row over creating another. Confirm ambiguous remasters, remakes, episodic releases, and games sharing a title.

## Backlog eligibility

From campaign and pool history:

1. Exclude games assigned as a campaign winner.
2. Count distinct prior election pools containing the game.
3. `0-2` prior appearances: eligible.
4. `3+` unsuccessful appearances: ineligible until explicitly recommended again in a later meeting.
5. A new explicit recommendation re-enters the game for the current cycle and must be attributed to the recommender.

Do not infer eligibility from the `suggestion` boolean alone.

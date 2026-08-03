---
name: research-bonfire-games
description: Research and prepare Sob a Luz do Bonfire game records. Use when a game is recommended, when creating or updating a game in the database, when finding its canonical Steam page, official trailer, banner image, and HowLongToBeat duration, or when checking whether a game satisfies the club's duration and election-backlog rules.
---

# Research Bonfire Games

Produce a verified game record and add it through the project MCP when requested.

## Workflow

1. Call `list_games` by normalized title and Steam URL before creating anything.
2. Browse current primary sources for the canonical Steam store page and an official developer/publisher trailer.
3. Check HowLongToBeat for Main + Extras. The club limit is 20 hours.
4. Prefer a user-provided banner. Otherwise use a clear, durable horizontal header image that shows the actual game.
5. Preserve the canonical title, including subtitle and release-year disambiguation.
6. Set `suggestion: true` for a newly recommended game.
7. If this is part of a pool/campaign request, return the record to `$manage-bonfire-cycle` for transactional preview/apply. For a standalone request, use `upsert_games` and read the record back.

Never create a player while creating a game. The recommender is recorded separately as a campaign participant.

## Source quality

- Steam: use the direct `store.steampowered.com/app/...` page.
- Trailer: prefer the developer, publisher, or platform-holder YouTube channel. Avoid reactions, reviews, and reuploads.
- Duration: use the specific HowLongToBeat game page when available; otherwise use its search URL and state that the match is inferred.
- Banner: verify the URL loads. Do not replace a user-provided image without explaining why it is unusable.

Read [references/game-record.md](references/game-record.md) for output shape and eligibility checks.

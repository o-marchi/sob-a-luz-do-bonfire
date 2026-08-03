import { describe, expect, it } from 'vitest'
import {
  calculateUserTokens,
  formatJourneyCount,
  getJourneyFlags,
  getJourneyPlayers,
  getJourneyStatus,
  getUserTokenBreakdown,
} from '../userService'
import type { CampaignPlayer } from '@/types/Campaign'

const createCampaignPlayer = (overrides: Partial<CampaignPlayer> = {}): CampaignPlayer => ({
  id: 1,
  player: { id: 1, name: 'Jogador' },
  played_the_game: false,
  finished_the_game: false,
  suggested_a_game: false,
  partook_in_the_meeting: false,
  tokens: 1,
  ...overrides,
})

describe('user token breakdown', () => {
  it('shows the base token and unapplied campaign bonuses', () => {
    const breakdown = getUserTokenBreakdown(createCampaignPlayer())

    expect(breakdown.map(({ key, value, applied }) => ({ key, value, applied }))).toEqual([
      { key: 'base', value: 1, applied: true },
      { key: 'played', value: 0, applied: false },
      { key: 'finished', value: 0, applied: false },
      { key: 'meeting', value: 0, applied: false },
      { key: 'suggested', value: 0, applied: false },
    ])
  })

  it('explains every bonus and deduction in the total', () => {
    const player = createCampaignPlayer({
      played_the_game: true,
      finished_the_game: true,
      partook_in_the_meeting: true,
      suggested_a_game: true,
      tokens: 3,
    })

    expect(calculateUserTokens(player)).toBe(3)
    expect(getUserTokenBreakdown(player).map(({ value }) => value)).toEqual([1, 1, 1, 1, -1])
  })
})

describe('campaign journey status', () => {
  it.each([
    [{ played_the_game: false, finished_the_game: false }, 'not-started'],
    [{ played_the_game: true, finished_the_game: false }, 'playing'],
    [{ played_the_game: true, finished_the_game: true }, 'finished'],
  ] as const)('maps campaign flags to %s', (flags, expectedStatus) => {
    expect(getJourneyStatus(createCampaignPlayer(flags))).toBe(expectedStatus)
  })

  it('maps each status back to a valid API payload', () => {
    expect(getJourneyFlags('not-started')).toEqual({
      played_the_game: false,
      finished_the_game: false,
    })
    expect(getJourneyFlags('playing')).toEqual({
      played_the_game: true,
      finished_the_game: false,
    })
    expect(getJourneyFlags('finished')).toEqual({
      played_the_game: true,
      finished_the_game: true,
    })
  })

  it.each([
    [0, '0 pessoas na jornada'],
    [1, '1 pessoa na jornada'],
    [12, '12 pessoas na jornada'],
  ])('formats a journey count of %i', (count, label) => {
    expect(formatJourneyCount(count)).toBe(label)
  })

  it('keeps players ordered by stable player id when progress changes', () => {
    const players = [
      createCampaignPlayer({
        id: 90,
        player: { id: 9, name: 'Nove' },
        played_the_game: true,
        finished_the_game: true,
      }),
      createCampaignPlayer({
        id: 20,
        player: { id: 2, name: 'Dois' },
        played_the_game: true,
      }),
      createCampaignPlayer({
        id: 70,
        player: { id: 7, name: 'Sete' },
        played_the_game: true,
      }),
    ]

    expect(getJourneyPlayers(players).map(({ player }) => player.id)).toEqual([2, 7, 9])

    players[1]!.finished_the_game = true
    expect(getJourneyPlayers(players).map(({ player }) => player.id)).toEqual([2, 7, 9])
  })
})

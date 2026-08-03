import { describe, expect, it } from 'vitest'
import { calculateUserTokens, getUserTokenBreakdown } from '../userService'
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

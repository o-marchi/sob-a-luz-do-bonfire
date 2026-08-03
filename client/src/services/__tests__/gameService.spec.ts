import { describe, expect, it } from 'vitest'
import { formatDurationLabel, getGameCover } from '../gameService'
import type { Game } from '@/types/Game'

describe('getGameCover', () => {
  it('returns the game cover when it is available', () => {
    const game: Game = {
      id: 1,
      title: 'Dark Souls',
      suggestion: false,
      cover: 'https://example.com/cover.jpg',
    }

    expect(getGameCover(game)).toBe('https://example.com/cover.jpg')
  })

  it('returns an empty string when the game or cover is missing', () => {
    expect(getGameCover(null)).toBe('')
    expect(getGameCover()).toBe('')
    expect(
      getGameCover({
        id: 1,
        title: 'Dark Souls',
        suggestion: false,
      }),
    ).toBe('')
  })
})

describe('formatDurationLabel', () => {
  it('rounds half-hour estimates up to whole hours', () => {
    expect(formatDurationLabel('8½–13½ h')).toBe('9–14 h')
    expect(formatDurationLabel('8.5 a 13,5 horas')).toBe('9 a 14 horas')
  })

  it('preserves whole-hour estimates and empty values', () => {
    expect(formatDurationLabel('11–18 h')).toBe('11–18 h')
    expect(formatDurationLabel(null)).toBe('')
    expect(formatDurationLabel()).toBe('')
  })
})

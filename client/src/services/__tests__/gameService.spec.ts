import { describe, expect, it } from 'vitest'
import { getGameCover } from '../gameService'
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

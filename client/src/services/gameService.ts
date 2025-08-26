import type { Game } from '@/types/Game'

export const getGameCover = (game: Game): string => {
  return game?.cover || ''
}

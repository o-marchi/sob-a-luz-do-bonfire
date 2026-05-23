import type { Game } from '@/types/Game'

export const getGameCover = (game?: Game | null): string => {
  return game?.cover || ''
}

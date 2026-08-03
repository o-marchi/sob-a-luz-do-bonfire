import type { Game } from '@/types/Game'

export const getGameCover = (game?: Game | null): string => {
  return game?.cover || ''
}

export const formatDurationLabel = (label?: string | null): string => {
  if (!label) {
    return ''
  }

  return label.replace(/(\d+)\s*(?:[.,]5|½)/g, (_, hours: string) => {
    return String(Number(hours) + 1)
  })
}

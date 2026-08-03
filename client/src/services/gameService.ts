import api from './api'
import type { Game, GameBacklog } from '@/types/Game'

export const getGameBacklog = async (): Promise<GameBacklog> => {
  const { data } = await api.get<GameBacklog>('/games/backlog')
  return data
}

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

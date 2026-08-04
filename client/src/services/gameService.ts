import api from './api'
import type {
  CreatedGameRecommendation,
  Game,
  GameBacklog,
  GameRecommendationAssessment,
  SteamGameSearchResult,
} from '@/types/Game'

export const getGameBacklog = async (): Promise<GameBacklog> => {
  const { data } = await api.get<GameBacklog>('/games/backlog')
  return data
}

export const searchGameRecommendations = async (
  query: string,
  signal?: AbortSignal,
): Promise<SteamGameSearchResult[]> => {
  const { data } = await api.get<SteamGameSearchResult[]>('/games/recommendations/search', {
    params: { query },
    signal,
  })
  return data
}

export const assessGameRecommendation = async (
  steamAppId: number,
): Promise<GameRecommendationAssessment> => {
  const { data } = await api.post<GameRecommendationAssessment>('/games/recommendations/assess', {
    steamAppId,
  })
  return data
}

export const createGameRecommendation = async (
  assessmentToken: string,
): Promise<CreatedGameRecommendation> => {
  const { data } = await api.post<CreatedGameRecommendation>('/games/recommendations', {
    assessmentToken,
  })
  return data
}

export const deleteGameRecommendation = async (): Promise<void> => {
  await api.delete('/games/recommendations')
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

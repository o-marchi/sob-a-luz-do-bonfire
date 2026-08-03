import api from './api'
import type { Campaign, PlayerGameInformation } from '@/types/Campaign.ts'

export const getCurrentCampaign = async (): Promise<Campaign> => {
  const { data: campaign } = await api.get<Campaign>('/campaign/current', {
    params: {
      includePlayerInCampaign: true,
    },
  })

  return campaign
}

export const getCampaignHistory = async (): Promise<Campaign[]> => {
  const { data: campaigns } = await api.get<Campaign[]>('/campaign/history')

  return campaigns
}

export const updatePlayerGameInformation = async (
  playerGameInformation: PlayerGameInformation,
): Promise<Campaign> => {
  const { data: campaign } = await api.put<Campaign>('/campaign/update-player-game-information', {
    ...playerGameInformation,
  })

  return campaign
}

export const vote = async (option: number): Promise<Campaign> => {
  const { data: campaign } = await api.post<Campaign>('/campaign/vote', {
    optionId: option,
  })

  return campaign
}

export const undoVote = async (): Promise<Campaign> => {
  const { data: campaign } = await api.post<Campaign>('/campaign/undo-vote')

  return campaign
}

export const recalculateElectionResult = async (): Promise<boolean> => {
  await api.get('/campaign/recalculate-election-result')

  return true
}

import api from './api'
import type { Campaign, PlayerGameInformation } from '@/types/Campaign.ts'

export const getCurrentCampaign = async (): Promise<Campaign | null> => {
  const { data: campaign } = await api.get<Campaign>('/campaign/current', {
    params: {
      includePlayerInCampaign: true,
    },
  })

  return campaign
}

export const updatePlayerGameInformation = async (
  playerGameInformation: PlayerGameInformation,
): Promise<Campaign> => {
  const {
    data: { campaign },
  } = await api.put('/campaign/update-player-game-information', {
    ...playerGameInformation,
  })

  return campaign
}

export const vote = async (option: string): Promise<Campaign> => {
  const {
    data: { campaign },
  } = await api.post('/campaign/vote', {
    optionId: option,
  })

  return campaign
}

export const undoVote = async (): Promise<Campaign> => {
  const {
    data: { campaign },
  } = await api.post('/campaign/undo-vote')

  return campaign
}

export const recalculateElectionResult = async (): Promise<boolean> => {
  await api.get('/campaign/recalculate-election-result')

  return true
}

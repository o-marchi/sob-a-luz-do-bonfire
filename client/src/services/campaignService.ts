import api from './api'
import type { Campaign, PlayerGameInformation } from '@/types/Campaign.ts'

export const getCurrentCampaign = async (): Promise<Campaign | null> => {
  const {
    data: { campaign },
  } = await api.get<{ campaign: Campaign }>('/campaign/current', {
    params: {
      includePlayerInCampaign: true,
    },
  })

  return campaign
}

export const updatePlayerGameInformation = async (
  playerGameInformation: PlayerGameInformation,
): Promise<boolean> => {
  await api.put('/campaign/update-player-game-information', {
    ...playerGameInformation,
  })

  return true
}

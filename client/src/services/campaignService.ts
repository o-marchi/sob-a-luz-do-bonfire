import api from './api'
import { convertGameDataToGame } from '@/services/gameService.ts'
import type { Campaign, CampaignData, CampaignUser, CampaignUserData } from '@/types/Campaign.ts'
import { calculateUserTokens } from '@/services/userService.ts'


export const convertCampaignUserDataToCampaignUser = (campaignUserData: CampaignUserData): CampaignUser => {

  return {
    ...campaignUserData,
    id: campaignUserData?.users_permissions_user?.id,
    username: campaignUserData?.users_permissions_user?.username,
    email: campaignUserData?.users_permissions_user?.email,
    provider: campaignUserData?.users_permissions_user?.provider,
    tokens: calculateUserTokens(campaignUserData),
  }
}

export const getCurrentCampaign = async (): Promise<Campaign> => {
  const {
    data: campaignData,
  } = await api.get<CampaignData>(
    '/current-campaign'
  )

  return {
    ...campaignData,
    game: campaignData?.game ? convertGameDataToGame(campaignData.game) : null,
    users: campaignData?.user?.map(convertCampaignUserDataToCampaignUser) || [],
  }
}

interface PlayerGameInformation {
  played_the_game: boolean
  finished_the_game: boolean
}

export const updatePlayerGameInformation =
  async(playerGameInformation: PlayerGameInformation): Promise<void> => {

  await api.post( '/update-player-game-information', {
    ...playerGameInformation,
  });

  return true;
}

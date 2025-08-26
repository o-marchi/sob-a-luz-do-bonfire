import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Campaign, CampaignPlayer, Election } from '@/types/Campaign.ts'
import type { Game } from '@/types/Game.ts'
import { getCurrentCampaign } from '@/services/campaignService.ts'
import { useAuthStore } from '@/stores/auth.ts'

export const useCampaignStore = defineStore('campaign', () => {
  // State
  const campaign = ref<Campaign | null>(null)
  const currentGame = ref<Game | null>(null)
  const loadingCampaign = ref<boolean>(true)
  const campaignUser = ref<CampaignPlayer | null>(null)
  const electionActive = ref<boolean>(false)
  const election = ref<Election | null>(null)

  // Actions
  async function init(campaignValue?: Campaign) {
    const auth = useAuthStore()
    await auth.init()

    if (campaignValue) {
      campaign.value = campaignValue
    } else {
      campaign.value = await getCurrentCampaign()
    }

    console.log(campaign.value)

    currentGame.value = campaign?.value?.game as Game

    const user = auth.user

    campaignUser.value = null

    if (user) {
      campaignUser.value =
        campaign.value?.players?.find(
          (player: CampaignPlayer) => player?.player?.id === user?.id,
        ) ?? null
    }

    electionActive.value = campaign.value?.election?.active || false
    election.value = campaign.value?.election || null

    loadingCampaign.value = false
  }

  return {
    campaign,
    currentGame,
    campaignUser,
    loadingCampaign,
    electionActive,
    election,

    init,
  }
})

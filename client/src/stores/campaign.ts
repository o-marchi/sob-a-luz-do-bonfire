import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Campaign, CampaignPlayer } from '@/types/Campaign.ts'
import type { Game } from '@/types/Game.ts'
import { getCurrentCampaign } from '@/services/campaignService.ts'
import { useAuthStore } from '@/stores/auth.ts'

export const useCampaignStore = defineStore('campaign', () => {
  // State
  const campaign = ref<Campaign | null>(null)
  const currentGame = ref<Game | null>(null)
  const loadingCampaign = ref<boolean>(true)
  const campaignUser = ref<CampaignPlayer | null>(null)

  // Actions
  async function init() {
    const auth = useAuthStore()
    await auth.init()

    campaign.value = await getCurrentCampaign()
    currentGame.value = campaign?.value?.game as Game

    const user = auth.user

    campaignUser.value = null

    if (user) {
      campaignUser.value =
        campaign.value?.players?.find(
          (player: CampaignPlayer) => player?.player?.id === user?.id,
        ) ?? null
    }

    loadingCampaign.value = false
  }

  return {
    campaign,
    currentGame,
    campaignUser,
    loadingCampaign,

    init,
  }
})

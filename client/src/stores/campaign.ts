import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Campaign, CampaignPlayer, Pool } from '@/types/Campaign'
import type { Game } from '@/types/Game'
import { getCurrentCampaign } from '@/services/campaignService'
import { useAuthStore } from '@/stores/auth'

export const useCampaignStore = defineStore('campaign', () => {
  // State
  const campaign = ref<Campaign | null>(null)
  const currentGame = ref<Game | null>(null)
  const loadingCampaign = ref<boolean>(true)
  const campaignUser = ref<CampaignPlayer | null>(null)
  const electionActive = ref<boolean>(false)
  const pool = ref<Pool | null>(null)

  // Actions
  async function init(campaignValue?: Campaign) {
    loadingCampaign.value = true

    try {
      const auth = useAuthStore()
      await auth.init()

      campaign.value = campaignValue ?? (await getCurrentCampaign())
      currentGame.value = campaign.value?.game ?? null
      campaignUser.value =
        campaign.value?.players?.find(
          (entry: CampaignPlayer) => entry.player?.id === auth.user?.id,
        ) ?? null
      electionActive.value = campaign.value?.electionActive ?? false
      pool.value = campaign.value?.pool ?? null
    } finally {
      loadingCampaign.value = false
    }
  }

  return {
    campaign,
    currentGame,
    campaignUser,
    loadingCampaign,
    electionActive,
    election: pool,

    init,
  }
})

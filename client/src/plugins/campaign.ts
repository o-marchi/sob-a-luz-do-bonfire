import type { App } from 'vue'
import { useCampaignStore } from '@/stores/campaign.ts'

export default {
  install: (app: App) => {
    const campaignStore = useCampaignStore()

    // Initialize auth state
    campaignStore.init()

    // Make auth store available globally
    app.provide('campaignStore', campaignStore)
  }
}

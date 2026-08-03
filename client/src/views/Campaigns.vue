<script setup lang="ts">
import { getCampaignHistory } from '@/services/campaignService'
import type { Campaign } from '@/types/Campaign'
import { NButton, NSpace, useMessage } from 'naive-ui'
import { ref, onMounted } from 'vue'
import { getGameCover } from '@/services/gameService.ts'
import { LogoSteam, LogoYoutube } from '@vicons/ionicons5'

const campaigns = ref<Campaign[]>([])
const message = useMessage()

onMounted(async () => {
  try {
    campaigns.value = (await getCampaignHistory()).reverse()
  } catch {
    message.error('Não foi possível carregar o histórico de campanhas.')
  }
})
</script>

<template>
  <div>
    <div v-if="campaigns.length" class="campaign-timeline">
      <div v-for="campaign in campaigns" :key="campaign.id" class="campaign-timeline-item">
        <div class="campaign-timeline-item-left">
          <div v-if="campaign.game" class="campaign-item">
            <div class="campaign-item-cover">
              <div
                class="campaign-item-cover-bg"
                :style="`background-image: url('${getGameCover(campaign?.game)}')`"
              ></div>
              <div class="campaign-item-cover-content">
                <p v-if="campaign?.month">{{ campaign.month }} - {{ campaign.year }}</p>
                <h2>{{ campaign.game.title }}</h2>

                <div>
                  <n-space>
                    <n-button
                      v-if="campaign?.game?.steam"
                      icon-placement="left"
                      :tag="'a'"
                      :href="campaign.game.steam"
                      target="_blank"
                    >
                      <template #icon>
                        <LogoSteam />
                      </template>
                      Steam
                    </n-button>

                    <n-button
                      v-if="campaign?.game?.trailer"
                      icon-placement="left"
                      :tag="'a'"
                      :href="campaign.game.trailer"
                      target="_blank"
                    >
                      <template #icon>
                        <LogoYoutube />
                      </template>
                      Trailer
                    </n-button>
                  </n-space>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="campaign-timeline-item-timeline">
          <div class="campaign-timeline__line"></div>
          <div class="campaign-timeline__circle"></div>
        </div>
        <div class="campaign-timeline-item-right"></div>
      </div>
    </div>
  </div>
</template>

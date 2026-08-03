<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NIcon, useMessage } from 'naive-ui'
import { LogoSteam, LogoYoutube, TimeOutline } from '@vicons/ionicons5'
import { getCampaignHistory } from '@/services/campaignService'
import { formatDurationLabel, getGameCover } from '@/services/gameService'
import { getJourneyPlayers } from '@/services/userService'
import type { Campaign } from '@/types/Campaign'
import JourneyRoster from '@/components/JourneyRoster.vue'

const campaigns = ref<Campaign[]>([])
const message = useMessage()

onMounted(async () => {
  try {
    campaigns.value = await getCampaignHistory()
  } catch {
    message.error('Não foi possível carregar o histórico de campanhas.')
  }
})
</script>

<template>
  <section v-if="campaigns.length" class="campaign-timeline" aria-label="Histórico de campanhas">
    <div v-for="campaign in campaigns" :key="campaign.id" class="campaign-timeline-item">
      <div class="campaign-timeline-item-left">
        <article v-if="campaign.game" class="campaign-history-card">
          <div
            class="campaign-history-card__art"
            :style="{ backgroundImage: `url('${getGameCover(campaign.game)}')` }"
          >
            <div class="campaign-history-card__shade"></div>

            <nav
              class="game-links campaign-history-card__links"
              :aria-label="`Links de ${campaign.game.title}`"
            >
              <a
                v-if="campaign.game.steam"
                :href="campaign.game.steam"
                target="_blank"
                rel="noopener noreferrer"
              >
                <n-icon size="17"><LogoSteam /></n-icon>
                Steam
              </a>
              <a
                v-if="campaign.game.trailer"
                :href="campaign.game.trailer"
                target="_blank"
                rel="noopener noreferrer"
              >
                <n-icon size="18"><LogoYoutube /></n-icon>
                Trailer
              </a>
              <a
                v-if="campaign.game.howLongToBeatUrl"
                :href="campaign.game.howLongToBeatUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                <n-icon size="17"><TimeOutline /></n-icon>
                {{ formatDurationLabel(campaign.game.durationLabel) || 'HowLongToBeat' }}
              </a>
            </nav>

            <header class="campaign-history-card__heading">
              <p>
                <strong>{{ campaign.month }}</strong>
                <span>{{ campaign.year }}</span>
              </p>
              <h2>{{ campaign.game.title }}</h2>
            </header>
          </div>

          <footer
            v-if="getJourneyPlayers(campaign.players ?? []).length"
            class="campaign-history-card__community"
          >
            <JourneyRoster :players="getJourneyPlayers(campaign.players ?? [])" />
          </footer>
        </article>
      </div>

      <div class="campaign-timeline-item-timeline" aria-hidden="true">
        <div class="campaign-timeline__line"></div>
        <div class="campaign-timeline__circle"></div>
      </div>

      <div class="campaign-timeline-item-right"></div>
    </div>
  </section>
</template>

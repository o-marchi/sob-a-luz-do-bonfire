<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useCampaignStore } from '@/stores/campaign.ts'
import {
  recalculateElectionResult,
  updatePlayerGameInformation,
} from '@/services/campaignService.ts'
import ElectionView from '@/components/ElectionView.vue'
import CurrentGameHearth from '@/components/CurrentGameHearth.vue'
import GameRecommendation from '@/components/GameRecommendation.vue'
import { getJourneyFlags, getJourneyStatus, type JourneyStatus } from '@/services/userService'
import { useAuthStore } from '@/stores/auth'

const campaignStore = useCampaignStore()
const { campaign, currentGame, campaignUser } = storeToRefs(campaignStore)
const { isAuthenticated } = storeToRefs(useAuthStore())

const journeyStatus = ref<JourneyStatus>('not-started')
const saveState = ref<'idle' | 'saving' | 'saved'>('idle')
let saveStateTimer: number | null = null
const message = useMessage()

onMounted(async () => {
  try {
    await campaignStore.init()
  } catch {
    message.error('Não foi possível carregar a campanha. Tente novamente.')
    return
  }

  if (campaignUser.value) {
    journeyStatus.value = getJourneyStatus(campaignUser.value)
  }
})

onBeforeUnmount(() => {
  if (saveStateTimer !== null) {
    window.clearTimeout(saveStateTimer)
  }
})

const params = new URLSearchParams(window.location.search)
const authenticationError = params.get('authentication_error')

if (authenticationError) {
  const authenticationMessage =
    authenticationError === 'not_member'
      ? 'A chama ainda não reconhece você. Entre no Discord do Bonfire e tente novamente.'
      : 'Não foi possível confirmar sua presença no Discord. Tente novamente.'

  message.error(authenticationMessage, {
    duration: 5000,
  })

  history.replaceState({}, '', window.location.pathname)
}

const changeJourney = async (status: JourneyStatus) => {
  if (saveState.value === 'saving' || status === journeyStatus.value) {
    return
  }

  const previousStatus = journeyStatus.value
  journeyStatus.value = status
  saveState.value = 'saving'

  if (saveStateTimer !== null) {
    window.clearTimeout(saveStateTimer)
  }

  try {
    const newCampaignValue = await updatePlayerGameInformation(getJourneyFlags(status))
    await campaignStore.init(newCampaignValue)

    if (campaignUser.value) {
      journeyStatus.value = getJourneyStatus(campaignUser.value)
    }

    saveState.value = 'saved'
    saveStateTimer = window.setTimeout(() => {
      saveState.value = 'idle'
      saveStateTimer = null
    }, 1800)
  } catch {
    journeyStatus.value = previousStatus
    saveState.value = 'idle'
    message.error('Não foi possível salvar a informação. Tente novamente.')
  }
}

const recalculateElection = async () => {
  try {
    await recalculateElectionResult()
  } catch {
    message.error('Não foi possível recalcular a eleição.')
  }
}
</script>

<template>
  <div>
    <button class="secret-action" @click="recalculateElection"></button>

    <ElectionView />

    <CurrentGameHearth
      v-if="campaign && currentGame"
      :campaign="campaign"
      :game="currentGame"
      :campaign-user="campaignUser"
      :journey-status="journeyStatus"
      :save-state="saveState"
      :is-authenticated="isAuthenticated"
      @change-journey="changeJourney"
    />

    <GameRecommendation
      v-if="campaign && isAuthenticated && !campaign.electionActive"
      :campaign-user="campaignUser"
    />
  </div>
</template>

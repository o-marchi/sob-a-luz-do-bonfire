<script setup lang="ts">
import { NTooltip } from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CampaignPlayer } from '@/types/Campaign'
import { calculateJourneyRosterSpacing, getPlayerName } from '@/services/userService'

const props = withDefaults(
  defineProps<{
    players: CampaignPlayer[]
    currentPlayerId?: number
    showNames?: boolean
  }>(),
  {
    currentPlayerId: undefined,
    showNames: false,
  },
)

const playerStatus = (campaignPlayer: CampaignPlayer) =>
  campaignPlayer.finished_the_game ? 'Concluiu' : 'A caminho'

const failedAvatars = ref(new Set<number>())
const rosterElement = ref<HTMLElement | null>(null)
const playerSpacing = ref(0)
const playerWidth = computed(() => (props.showNames ? 92 : 32))
let resizeObserver: ResizeObserver | null = null

const updatePlayerSpacing = () => {
  if (!rosterElement.value) {
    return
  }

  playerSpacing.value = calculateJourneyRosterSpacing(
    rosterElement.value.clientWidth,
    props.players.length,
    playerWidth.value,
    props.showNames ? 20 : 28,
  )
}

const rosterStyle = computed(() => ({
  '--journey-player-spacing': `${playerSpacing.value}px`,
  '--journey-player-width': `${playerWidth.value}px`,
}))

const hasWorkingAvatar = (campaignPlayer: CampaignPlayer) =>
  Boolean(campaignPlayer.player.discord?.avatar) && !failedAvatars.value.has(campaignPlayer.id)

const markAvatarAsFailed = (campaignPlayerId: number) => {
  failedAvatars.value = new Set(failedAvatars.value).add(campaignPlayerId)
}

onMounted(() => {
  updatePlayerSpacing()
  resizeObserver = new ResizeObserver(updatePlayerSpacing)
  resizeObserver.observe(rosterElement.value!)
})

watch([() => props.players.length, () => props.showNames], async () => {
  await nextTick()
  updatePlayerSpacing()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div
    ref="rosterElement"
    class="journey-roster"
    :class="{ 'journey-roster--named': showNames }"
    :style="rosterStyle"
  >
    <n-tooltip v-for="campaignPlayer in players" :key="campaignPlayer.id" placement="top">
      <template #trigger>
        <div
          class="journey-player"
          :aria-label="`${getPlayerName(campaignPlayer)} · ${playerStatus(campaignPlayer)}`"
          tabindex="0"
        >
          <span
            class="player-chip"
            :class="{
              'player-chip--current': campaignPlayer.player.id === currentPlayerId,
              'player-chip--finished': campaignPlayer.finished_the_game,
            }"
          >
            <img
              v-if="hasWorkingAvatar(campaignPlayer)"
              :src="campaignPlayer.player.discord?.avatar ?? undefined"
              alt=""
              @error="markAvatarAsFailed(campaignPlayer.id)"
            />
            <span v-else class="player-chip__initial" aria-hidden="true">
              {{ getPlayerName(campaignPlayer).charAt(0).toUpperCase() }}
            </span>
          </span>

          <span v-if="showNames" class="journey-player__name">
            {{ getPlayerName(campaignPlayer) }}
          </span>
        </div>
      </template>

      <span>{{ getPlayerName(campaignPlayer) }} · {{ playerStatus(campaignPlayer) }}</span>
    </n-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import { CalendarOutline, LogoSteam, LogoYoutube, TimeOutline } from '@vicons/ionicons5'
import type { Campaign, CampaignPlayer } from '@/types/Campaign'
import type { Game } from '@/types/Game'
import { formatDurationLabel, getGameCover } from '@/services/gameService'
import { formatJourneyCount, getJourneyPlayers, type JourneyStatus } from '@/services/userService'

type SaveState = 'idle' | 'saving' | 'saved'

const props = defineProps<{
  campaign: Campaign
  game: Game
  campaignUser: CampaignPlayer | null
  journeyStatus: JourneyStatus
  saveState: SaveState
}>()

const emit = defineEmits<{
  changeJourney: [status: JourneyStatus]
}>()

const journeyOptions: Array<{ value: JourneyStatus; label: string }> = [
  { value: 'not-started', label: 'Ainda não comecei' },
  { value: 'playing', label: 'Em jornada' },
  { value: 'finished', label: 'Concluí' },
]

const journeyPlayers = computed(() => {
  return getJourneyPlayers(props.campaign.players ?? [])
})

const journeyHeading = computed(() => {
  return formatJourneyCount(journeyPlayers.value.length)
})

const meeting = computed(() => {
  if (!props.campaign.meetingAt) {
    return null
  }

  const date = new Date(props.campaign.meetingAt)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const day = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .format(date)
    .replace(/\./g, '')

  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  return { day, time }
})

const coverStyle = computed(() => {
  const cover = getGameCover(props.game)
  return cover ? { backgroundImage: `url('${cover}')` } : undefined
})

const durationLabel = computed(() => formatDurationLabel(props.game.durationLabel))

const playerName = (campaignPlayer: CampaignPlayer) => {
  return (
    campaignPlayer.player.name?.trim() ||
    campaignPlayer.player.discord?.globalName?.trim() ||
    campaignPlayer.player.discord?.username?.trim() ||
    'Participante'
  )
}

const isCurrentPlayer = (campaignPlayer: CampaignPlayer) => {
  return campaignPlayer.player.id === props.campaignUser?.player.id
}
</script>

<template>
  <section class="current-game-hearth" aria-labelledby="current-game-heading">
    <header class="hearth-heading">
      <div>
        <p>Neste ciclo</p>
        <h2 id="current-game-heading">{{ campaign.month }}</h2>
      </div>

      <component
        :is="campaign.meetingUrl ? 'a' : 'div'"
        v-if="meeting || campaign.meetingLocation"
        class="meeting-callout"
        :href="campaign.meetingUrl || undefined"
        :target="campaign.meetingUrl ? '_blank' : undefined"
        :rel="campaign.meetingUrl ? 'noopener noreferrer' : undefined"
      >
        <n-icon size="17"><CalendarOutline /></n-icon>
        <span>
          <small>Próximo encontro</small>
          <strong v-if="meeting">{{ meeting.day }} · {{ meeting.time }}</strong>
          <strong v-if="campaign.meetingLocation">{{ campaign.meetingLocation }}</strong>
        </span>
      </component>
    </header>

    <article class="game-spotlight">
      <div class="game-spotlight__art" :style="coverStyle">
        <div class="game-spotlight__shade"></div>
      </div>

      <div class="game-spotlight__details">
        <div class="game-spotlight__copy">
          <h3>{{ game.title }}</h3>
          <p v-if="game.summary">{{ game.summary }}</p>
        </div>

        <nav class="game-links" aria-label="Links do jogo">
          <a v-if="game.steam" :href="game.steam" target="_blank" rel="noopener noreferrer">
            <n-icon size="17"><LogoSteam /></n-icon>
            Steam
          </a>
          <a v-if="game.trailer" :href="game.trailer" target="_blank" rel="noopener noreferrer">
            <n-icon size="18"><LogoYoutube /></n-icon>
            Trailer
          </a>
          <a
            v-if="game.howLongToBeatUrl"
            :href="game.howLongToBeatUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <n-icon size="17"><TimeOutline /></n-icon>
            {{ durationLabel || 'HowLongToBeat' }}
          </a>
        </nav>
      </div>
    </article>

    <div v-if="campaignUser || journeyPlayers.length" class="hearth-community">
      <header class="hearth-community__header">
        <h3 id="progress-heading">
          {{ campaignUser ? 'Sua jornada' : 'A jornada do grupo' }}
        </h3>
        <span v-if="journeyPlayers.length" id="group-progress-heading">
          {{ journeyHeading }}
        </span>
      </header>

      <div class="journey-shell">
        <section v-if="campaignUser" class="personal-progress" aria-labelledby="progress-heading">
          <div
            class="journey-control"
            aria-label="Seu progresso no jogo"
            :aria-busy="saveState === 'saving'"
          >
            <button
              v-for="option in journeyOptions"
              :key="option.value"
              type="button"
              :class="[
                `journey-control__option--${option.value}`,
                { 'journey-control__option--selected': journeyStatus === option.value },
              ]"
              :aria-pressed="journeyStatus === option.value"
              :disabled="saveState === 'saving'"
              @click="emit('changeJourney', option.value)"
            >
              <span class="journey-control__marker" aria-hidden="true"></span>
              <span>{{ option.label }}</span>
            </button>
          </div>
        </section>

        <section
          v-if="journeyPlayers.length"
          class="group-progress"
          aria-labelledby="group-progress-heading"
        >
          <div class="journey-roster">
            <div
              v-for="campaignPlayer in journeyPlayers"
              :key="campaignPlayer.id"
              class="player-chip"
              :class="{
                'player-chip--current': isCurrentPlayer(campaignPlayer),
                'player-chip--finished': campaignPlayer.finished_the_game,
              }"
              :title="`${playerName(campaignPlayer)} · ${campaignPlayer.finished_the_game ? 'Concluiu' : 'A caminho'}`"
            >
              <img
                v-if="campaignPlayer.player.discord?.avatar"
                :src="campaignPlayer.player.discord.avatar"
                :alt="playerName(campaignPlayer)"
              />
              <span v-else class="player-chip__initial" aria-hidden="true">
                {{ playerName(campaignPlayer).charAt(0).toUpperCase() }}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

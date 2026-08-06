<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CheckmarkCircle,
  EllipsisHorizontal,
  FlameOutline,
  LogoSteam,
  LogoYoutube,
  TimeOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NIcon, NSpin, NTooltip } from 'naive-ui'
import { formatDurationLabel, getGameCover } from '@/services/gameService'
import type { BacklogGame, GameRecommender } from '@/types/Game'

const props = withDefaults(
  defineProps<{
    game: BacklogGame
    retirementThreshold: number
    nextVote?: boolean
    currentVote?: boolean
    canRetire?: boolean
    retiring?: boolean
  }>(),
  { nextVote: false, currentVote: false, canRetire: false, retiring: false },
)

const emit = defineEmits<{
  retire: [game: BacklogGame]
}>()

const failedRecommenderAvatars = ref(new Set<number>())
const featuredVote = computed(() => props.nextVote || props.currentVote)

const appearanceLabel = (count: number) => {
  if (count === 0) return 'Ainda não passou'
  return `${count} ${count === 1 ? 'passagem' : 'passagens'}`
}

const coverStyle = () => ({
  backgroundImage: getGameCover(props.game) ? `url('${getGameCover(props.game)}')` : undefined,
})

const hasRecommenderAvatar = (recommender: GameRecommender) =>
  Boolean(recommender.avatar) && !failedRecommenderAvatars.value.has(recommender.id)

const markRecommenderAvatarFailed = (recommender: GameRecommender) => {
  failedRecommenderAvatars.value = new Set(failedRecommenderAvatars.value).add(recommender.id)
}

const recommenderInitial = (recommender: GameRecommender) =>
  recommender.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?'

const visibleRecommenders = () => (props.game.recommendedBy ?? []).slice(0, 3)

const hiddenRecommenderNames = () =>
  (props.game.recommendedBy ?? [])
    .slice(3)
    .map((recommender) => recommender.name)
    .join(', ')
</script>

<template>
  <article
    class="backlog-card"
    :class="{
      'backlog-card--next-vote': nextVote,
      'backlog-card--current-vote': currentVote,
    }"
  >
    <div class="backlog-card__art" :style="coverStyle()">
      <div class="backlog-card__shade"></div>

      <span v-if="currentVote" class="backlog-card__vote-state backlog-card__vote-state--current">
        <n-icon size="14"><FlameOutline /></n-icon>
        Votação acesa
      </span>
      <span v-else-if="nextVote" class="backlog-card__vote-state">
        <n-icon size="14"><CheckmarkCircle /></n-icon>
        Próxima votação
      </span>

      <span
        class="backlog-card__count"
        :class="{
          'backlog-card__count--aside': featuredVote,
        }"
      >
        <strong>{{ game.electionAppearances }}</strong>
        / {{ retirementThreshold }}
      </span>

      <details v-if="canRetire" class="backlog-card__menu">
        <summary
          :aria-label="`Opções para ${game.title}`"
          :aria-disabled="retiring"
          @click="retiring && $event.preventDefault()"
        >
          <n-spin v-if="retiring" :size="13" />
          <n-icon v-else size="18"><EllipsisHorizontal /></n-icon>
        </summary>
        <button type="button" :disabled="retiring" @click="emit('retire', game)">
          <n-icon size="15"><TrashOutline /></n-icon>
          {{ retiring ? 'Retirando…' : 'Retirar da rotação' }}
        </button>
      </details>

      <header class="backlog-card__title">
        <h3>{{ game.title }}</h3>
      </header>
    </div>

    <footer class="backlog-card__footer">
      <div class="backlog-card__history">
        <div
          class="backlog-embers"
          :aria-label="`${appearanceLabel(game.electionAppearances)} de ${retirementThreshold} antes de virar cinza`"
        >
          <span
            v-for="position in retirementThreshold"
            :key="position"
            :class="{ 'backlog-ember--lit': position <= game.electionAppearances }"
            aria-hidden="true"
          ></span>
        </div>
        <span v-if="!featuredVote">{{ appearanceLabel(game.electionAppearances) }}</span>
      </div>

      <div
        v-if="game.recommendedBy?.length"
        class="backlog-card__recommenders"
        aria-label="Pessoas que sugeriram este jogo ao grupo"
      >
        <n-tooltip
          v-for="recommender in visibleRecommenders()"
          :key="recommender.id"
          placement="top"
        >
          <template #trigger>
            <span
              class="backlog-recommender"
              tabindex="0"
              :aria-label="`Sugerido por ${recommender.name}`"
            >
              <img
                v-if="hasRecommenderAvatar(recommender)"
                :src="recommender.avatar ?? undefined"
                alt=""
                @error="markRecommenderAvatarFailed(recommender)"
              />
              <span v-else aria-hidden="true">{{ recommenderInitial(recommender) }}</span>
            </span>
          </template>
          Sugerido por {{ recommender.name }}
        </n-tooltip>

        <n-tooltip v-if="game.recommendedBy.length > 3" placement="top">
          <template #trigger>
            <span
              class="backlog-recommender backlog-recommender--more"
              tabindex="0"
              :aria-label="`Mais ${game.recommendedBy.length - 3} pessoas sugeriram este jogo`"
            >
              +{{ game.recommendedBy.length - 3 }}
            </span>
          </template>
          Também sugerido por {{ hiddenRecommenderNames() }}
        </n-tooltip>
      </div>

      <nav class="backlog-card__links" :aria-label="`Links de ${game.title}`">
        <a
          v-if="game.steam"
          :href="game.steam"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir na Steam"
        >
          <n-icon size="17"><LogoSteam /></n-icon>
        </a>
        <a
          v-if="game.trailer"
          :href="game.trailer"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Assistir ao trailer"
        >
          <n-icon size="17"><LogoYoutube /></n-icon>
        </a>
        <a
          v-if="game.howLongToBeatUrl"
          :href="game.howLongToBeatUrl"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`Ver duração${formatDurationLabel(game.durationLabel) ? `: ${formatDurationLabel(game.durationLabel)}` : ''}`"
        >
          <n-icon size="17"><TimeOutline /></n-icon>
        </a>
      </nav>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CheckmarkCircle, LogoSteam, LogoYoutube, TimeOutline } from '@vicons/ionicons5'
import { NIcon, NTooltip } from 'naive-ui'
import { formatDurationLabel, getGameCover } from '@/services/gameService'
import type { BacklogGame, GameRecommender } from '@/types/Game'

const props = withDefaults(
  defineProps<{
    game: BacklogGame
    retirementThreshold: number
    nextVote?: boolean
  }>(),
  { nextVote: false },
)

const failedRecommenderAvatars = ref(new Set<number>())

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
  <article class="backlog-card" :class="{ 'backlog-card--next-vote': nextVote }">
    <div class="backlog-card__art" :style="coverStyle()">
      <div class="backlog-card__shade"></div>

      <span v-if="nextVote" class="backlog-card__next-vote">
        <n-icon size="14"><CheckmarkCircle /></n-icon>
        Próxima votação
      </span>

      <span class="backlog-card__count" :class="{ 'backlog-card__count--aside': nextVote }">
        <strong>{{ game.electionAppearances }}</strong>
        / {{ retirementThreshold }}
      </span>

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
        <span v-if="!nextVote">{{ appearanceLabel(game.electionAppearances) }}</span>
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

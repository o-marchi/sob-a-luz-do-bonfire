<script setup lang="ts">
import { computed, ref } from 'vue'
import { CheckmarkCircle, LogoSteam, LogoYoutube, TimeOutline } from '@vicons/ionicons5'
import { NIcon, NTooltip, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useCampaignStore } from '@/stores/campaign'
import { useAuthStore } from '@/stores/auth'
import { formatDurationLabel, getGameCover } from '@/services/gameService'
import { undoVote, vote } from '@/services/campaignService'
import type { PoolOption } from '@/types/Campaign'
import type { GameRecommender } from '@/types/Game'
import type { User } from '@/types/User'

const campaignStore = useCampaignStore()
const { electionActive, election: pool } = storeToRefs(campaignStore)
const { user } = storeToRefs(useAuthStore())

const loadingVote = ref<boolean | number>(false)
const failedRecommenderAvatars = ref(new Set<number>())
const message = useMessage()

const didIVoteForThis = (players: User[]) =>
  Boolean(user.value && (players ?? []).some((player) => player?.id === user.value?.id))

const selectedOption = computed(() =>
  pool.value?.options.find((option) => didIVoteForThis(option.players ?? [])),
)

const durationLabel = (option: PoolOption) =>
  formatDurationLabel(option.game.durationLabel) ||
  (option.game.mainExtraHours != null ? `${option.game.mainExtraHours} h` : '')

const hasRecommenderAvatar = (recommender: GameRecommender) =>
  Boolean(recommender.avatar) && !failedRecommenderAvatars.value.has(recommender.id)

const markRecommenderAvatarFailed = (recommender: GameRecommender) => {
  failedRecommenderAvatars.value = new Set(failedRecommenderAvatars.value).add(recommender.id)
}

const recommenderInitial = (recommender: GameRecommender) =>
  recommender.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?'

const visibleRecommenders = (option: PoolOption) => (option.game.recommendedBy ?? []).slice(0, 3)

const hiddenRecommenderNames = (option: PoolOption) =>
  (option.game.recommendedBy ?? [])
    .slice(3)
    .map((recommender) => recommender.name)
    .join(', ')

const recommenderLabel = (option: PoolOption) => {
  const names = (option.game.recommendedBy ?? []).map((recommender) => recommender.name)
  if (!names.length) return ''
  if (names.length === 1) return `Sugerido por ${names[0]}`
  return `Sugerido por ${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

const undoVoteAction = async () => {
  loadingVote.value = true
  try {
    const newCampaignValue = await undoVote()
    await campaignStore.init(newCampaignValue)
  } catch {
    message.error('Não foi possível retirar o voto. Tente novamente.')
  } finally {
    loadingVote.value = false
  }
}

const voteAction = async (optionId: number) => {
  loadingVote.value = optionId
  try {
    const newCampaignValue = await vote(optionId)
    await campaignStore.init(newCampaignValue)
  } catch {
    message.error('Não foi possível registrar o voto. Tente novamente.')
  } finally {
    loadingVote.value = false
  }
}
</script>

<template>
  <section v-if="electionActive" class="election-hearth" aria-labelledby="election-heading">
    <header class="election-hearth__heading">
      <div>
        <span>Votação acesa</span>
        <h2 id="election-heading">Qual jogo recebe a próxima chama?</h2>
        <p>Conheça cada jornada e escolha com calma. A contagem permanece em segredo.</p>
      </div>
      <div v-if="selectedOption" class="election-hearth__receipt">
        <n-icon size="17"><CheckmarkCircle /></n-icon>
        <span>Seu voto está guardado</span>
      </div>
    </header>

    <div class="election-grid">
      <article
        v-for="option in pool?.options || []"
        :key="option.id"
        class="election-card"
        :class="{ 'election-card--selected': didIVoteForThis(option.players ?? []) }"
        :aria-busy="loadingVote === option.id"
      >
        <div
          class="election-card__art"
          :style="{ backgroundImage: `url('${getGameCover(option.game)}')` }"
        >
          <div class="election-card__shade"></div>

          <span v-if="didIVoteForThis(option.players ?? [])" class="election-card__selected-bar">
            <n-icon size="14"><CheckmarkCircle /></n-icon>
            Sua escolha
          </span>

          <nav class="election-card__links" :aria-label="`Links de ${option.game.title}`">
            <n-tooltip v-if="option.game.steam">
              <template #trigger>
                <a
                  :href="option.game.steam"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir na Steam"
                >
                  <n-icon size="17"><LogoSteam /></n-icon>
                </a>
              </template>
              Steam
            </n-tooltip>
            <n-tooltip v-if="option.game.trailer">
              <template #trigger>
                <a
                  :href="option.game.trailer"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Assistir ao trailer"
                >
                  <n-icon size="17"><LogoYoutube /></n-icon>
                </a>
              </template>
              Trailer
            </n-tooltip>
            <n-tooltip v-if="option.game.howLongToBeatUrl">
              <template #trigger>
                <a
                  :href="option.game.howLongToBeatUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ver duração no HowLongToBeat"
                >
                  <n-icon size="17"><TimeOutline /></n-icon>
                </a>
              </template>
              {{ durationLabel(option) || 'HowLongToBeat' }}
            </n-tooltip>
          </nav>

          <div class="election-card__title">
            <small v-if="durationLabel(option)">{{ durationLabel(option) }}</small>
            <h3>{{ option.game.title }}</h3>
          </div>
        </div>

        <div class="election-card__body">
          <p v-if="option.game.summary">{{ option.game.summary }}</p>
          <p v-else>Uma possível nova jornada para compartilhar ao redor da fogueira.</p>

          <div
            v-if="option.game.recommendedBy?.length"
            class="election-card__recommenders"
            :aria-label="recommenderLabel(option)"
          >
            <div class="backlog-card__recommenders" aria-hidden="true">
              <n-tooltip
                v-for="recommender in visibleRecommenders(option)"
                :key="recommender.id"
                placement="top"
              >
                <template #trigger>
                  <span class="backlog-recommender" tabindex="0">
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

              <n-tooltip v-if="option.game.recommendedBy.length > 3" placement="top">
                <template #trigger>
                  <span class="backlog-recommender backlog-recommender--more" tabindex="0">
                    +{{ option.game.recommendedBy.length - 3 }}
                  </span>
                </template>
                Também sugerido por {{ hiddenRecommenderNames(option) }}
              </n-tooltip>
            </div>
            <span>{{ recommenderLabel(option) }}</span>
          </div>

          <footer>
            <div v-if="didIVoteForThis(option.players ?? [])" class="game-links">
              <button type="button" :disabled="!!loadingVote" @click="undoVoteAction">
                {{ loadingVote === true ? 'Retirando…' : 'Retirar meu voto' }}
              </button>
            </div>
            <div v-else-if="!selectedOption" class="game-links">
              <button
                type="button"
                :disabled="!!loadingVote || !user"
                @click="voteAction(option.id)"
              >
                {{ loadingVote === option.id ? 'Guardando voto…' : 'Votar neste jogo' }}
              </button>
            </div>
            <span v-else class="election-card__quiet-state">Você já escolheu outra chama.</span>
            <small v-if="!user">Revele-se pelo Discord para votar.</small>
          </footer>
        </div>
      </article>
    </div>
  </section>
</template>

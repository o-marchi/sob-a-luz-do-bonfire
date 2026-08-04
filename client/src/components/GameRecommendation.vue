<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  CheckmarkCircle,
  FlameOutline,
  SearchOutline,
  TimeOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NIcon, NSpin } from 'naive-ui'
import axios from 'axios'
import { useCampaignStore } from '@/stores/campaign'
import type { CampaignPlayer } from '@/types/Campaign'
import type {
  CreatedGameRecommendation,
  GameRecommendationAssessment,
  SteamGameSearchResult,
} from '@/types/Game'
import {
  assessGameRecommendation,
  createGameRecommendation,
  deleteGameRecommendation,
  searchGameRecommendations,
} from '@/services/gameService'

const props = defineProps<{
  campaignUser: CampaignPlayer | null
}>()

type RecommendationState =
  | 'idle'
  | 'empty'
  | 'searching'
  | 'assessing'
  | 'assessed'
  | 'submitting'
  | 'success'
  | 'error'

const campaignStore = useCampaignStore()
const query = ref('')
const results = ref<SteamGameSearchResult[]>([])
const selectedGame = ref<SteamGameSearchResult | null>(null)
const assessment = ref<GameRecommendationAssessment | null>(null)
const recommendation = ref<CreatedGameRecommendation | null>(null)
const state = ref<RecommendationState>('idle')
const errorMessage = ref('')
const removingSuggestion = ref(false)
let searchTimer: number | undefined
let searchController: AbortController | null = null
let searchSequence = 0

const existingSuggestion = computed(
  () => props.campaignUser?.suggestedGame ?? recommendation.value?.game ?? null,
)

const statusMessage = computed(() => {
  if (state.value === 'assessing') {
    return 'Conferindo o tempo no HowLongToBeat e reunindo os detalhes…'
  }

  if (state.value === 'submitting') {
    return 'Guardando esta sugestão nas Brasas…'
  }

  if (!assessment.value) return ''

  switch (assessment.value.reason) {
    case 'too_long':
      return `${assessment.value.game.title} leva cerca de ${formatHours(assessment.value.game.mainExtraHours)} na campanha com extras. O limite do grupo é ${assessment.value.limitHours} h.`
    case 'duration_unavailable':
      return 'Não encontramos uma estimativa confiável para a campanha com extras. Por segurança, este jogo não pode ser sugerido agora.'
    case 'not_a_game':
      return 'Este item da Steam não é um jogo completo.'
    case 'already_played':
      return 'Este jogo já foi escolhido pelo grupo em uma campanha anterior.'
    case 'already_suggested':
      return `Você já sugeriu ${assessment.value.existingSuggestion?.title ?? 'outro jogo'} neste ciclo.`
    default:
      return `Cerca de ${formatHours(assessment.value.game.mainExtraHours)} na campanha com extras. Está dentro do limite do grupo.`
  }
})

const formatHours = (hours?: number | null) => {
  if (hours === null || hours === undefined) return 'tempo indisponível'
  const rounded = Math.round(hours * 2) / 2
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(rounded)} h`
}

const clearSearch = () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchController?.abort()
  searchController = null
  results.value = []
}

watch(query, (value) => {
  if (selectedGame.value?.title === value) return

  selectedGame.value = null
  assessment.value = null
  recommendation.value = null
  errorMessage.value = ''
  clearSearch()

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length < 2) {
    state.value = 'idle'
    return
  }

  const sequence = ++searchSequence
  state.value = 'searching'
  searchTimer = window.setTimeout(async () => {
    searchController = new AbortController()

    try {
      const matches = await searchGameRecommendations(normalized, searchController.signal)
      if (sequence !== searchSequence) return
      results.value = matches
      state.value = matches.length ? 'idle' : 'empty'
    } catch (error: unknown) {
      if (axios.isCancel(error) || sequence !== searchSequence) return
      state.value = 'error'
      errorMessage.value = 'Não foi possível pesquisar na Steam agora. Tente novamente.'
    }
  }, 350)
})

const selectGame = async (game: SteamGameSearchResult) => {
  clearSearch()
  selectedGame.value = game
  query.value = game.title
  assessment.value = null
  recommendation.value = null
  errorMessage.value = ''
  state.value = 'assessing'

  try {
    assessment.value = await assessGameRecommendation(game.steamAppId)
    state.value = 'assessed'
  } catch {
    state.value = 'error'
    errorMessage.value = 'A verificação não terminou. Tente selecionar o jogo novamente.'
  }
}

const submitRecommendation = async () => {
  const token = assessment.value?.assessmentToken
  if (!token || !assessment.value?.eligible) return

  state.value = 'submitting'
  errorMessage.value = ''

  try {
    recommendation.value = await createGameRecommendation(token)
    state.value = 'success'
    await campaignStore.init()
  } catch (error: unknown) {
    state.value = 'error'
    errorMessage.value = axios.isAxiosError<{ message?: string }>(error)
      ? error.response?.data?.message || 'Não foi possível salvar a sugestão.'
      : 'Não foi possível salvar a sugestão.'
  }
}

const removeSuggestion = async () => {
  if (removingSuggestion.value) return

  removingSuggestion.value = true
  errorMessage.value = ''

  try {
    await deleteGameRecommendation()
    recommendation.value = null
    resetSelection()
    await campaignStore.init()
  } catch (error: unknown) {
    errorMessage.value = axios.isAxiosError<{ message?: string }>(error)
      ? error.response?.data?.message || 'Não foi possível remover a sugestão.'
      : 'Não foi possível remover a sugestão.'
  } finally {
    removingSuggestion.value = false
  }
}

const resetSelection = () => {
  selectedGame.value = null
  assessment.value = null
  recommendation.value = null
  query.value = ''
  state.value = 'idle'
  errorMessage.value = ''
}

onBeforeUnmount(clearSearch)
</script>

<template>
  <section class="recommendation-hearth" aria-labelledby="recommendation-title">
    <header class="recommendation-heading">
      <div class="recommendation-heading__icon" aria-hidden="true">
        <n-icon size="20"><FlameOutline /></n-icon>
      </div>
      <div>
        <p>Próxima votação</p>
        <h2 id="recommendation-title">Traga um jogo para a fogueira</h2>
        <span>
          Vale jogo de até 20 horas, considerando a campanha e os extras. A pesquisa e os detalhes
          ficam por nossa conta.
        </span>
      </div>
    </header>

    <template v-if="existingSuggestion">
      <div class="recommendation-complete" role="status">
        <n-icon size="25"><CheckmarkCircle /></n-icon>
        <div>
          <span>Sua sugestão deste ciclo</span>
          <strong>{{ existingSuggestion.title }}</strong>
          <p>Já está nas Brasas e tem lugar garantido na próxima votação.</p>
        </div>
        <button
          type="button"
          class="recommendation-remove"
          :disabled="removingSuggestion"
          @click="removeSuggestion"
        >
          <n-spin v-if="removingSuggestion" :size="14" />
          <n-icon v-else size="15"><TrashOutline /></n-icon>
          {{ removingSuggestion ? 'Removendo…' : 'Remover e escolher outro' }}
        </button>
      </div>
      <p v-if="errorMessage" class="recommendation-error" role="alert">
        {{ errorMessage }}
      </p>
    </template>

    <div v-else class="recommendation-flow">
      <div class="game-combobox">
        <n-icon class="game-combobox__search" size="19"><SearchOutline /></n-icon>
        <input
          v-model="query"
          type="search"
          role="combobox"
          autocomplete="off"
          placeholder="Comece a escrever o nome de um jogo…"
          aria-label="Pesquisar jogo no acervo e na Steam"
          :aria-expanded="results.length > 0"
          aria-controls="game-search-results"
          :disabled="state === 'assessing' || state === 'submitting'"
        />
        <n-spin v-if="state === 'searching'" class="game-combobox__spinner" size="small" />

        <div
          v-if="results.length"
          id="game-search-results"
          class="game-search-results"
          role="listbox"
        >
          <button
            v-for="game in results"
            :key="game.steamAppId"
            type="button"
            role="option"
            @click="selectGame(game)"
          >
            <img v-if="game.image" :src="game.image" alt="" />
            <span v-else class="game-search-results__placeholder" aria-hidden="true"></span>
            <strong>{{ game.title }}</strong>
            <small>{{ game.source === 'catalog' ? 'No acervo' : 'Steam' }}</small>
          </button>
        </div>
      </div>

      <p v-if="state === 'empty'" class="recommendation-empty" role="status">
        Nenhum jogo encontrado no acervo ou na Steam. Tente outro nome.
      </p>

      <div
        v-if="state === 'assessing' || state === 'submitting'"
        class="recommendation-check recommendation-check--loading"
        role="status"
        aria-live="polite"
      >
        <n-spin :size="26" :stroke-width="12" stroke="#e7a06c" />
        <span>{{ statusMessage }}</span>
      </div>

      <article
        v-else-if="assessment"
        class="recommendation-check"
        :class="
          assessment.eligible ? 'recommendation-check--eligible' : 'recommendation-check--blocked'
        "
        aria-live="polite"
      >
        <div
          class="recommendation-game__cover"
          :style="
            assessment.game.cover
              ? { backgroundImage: `url('${assessment.game.cover}')` }
              : undefined
          "
        ></div>
        <div class="recommendation-game__details">
          <span>{{ assessment.eligible ? 'Dentro do limite' : 'Fora da regra' }}</span>
          <h3>{{ assessment.game.title }}</h3>
          <p>{{ statusMessage }}</p>
          <a
            v-if="assessment.game.howLongToBeatUrl"
            :href="assessment.game.howLongToBeatUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <n-icon size="15"><TimeOutline /></n-icon>
            Ver no HowLongToBeat
          </a>
        </div>
        <div v-if="assessment.eligible" class="recommendation-game__action">
          <small>Usa 1 token deste ciclo</small>
          <button type="button" @click="submitRecommendation">
            <n-icon size="16"><FlameOutline /></n-icon>
            Sugerir este jogo
          </button>
        </div>
        <button v-else type="button" class="recommendation-try-another" @click="resetSelection">
          Escolher outro
        </button>
      </article>

      <p v-if="state === 'error'" class="recommendation-error" role="alert">
        {{ errorMessage }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.recommendation-hearth {
  position: relative;
  margin: -32px 0 76px;
  padding: 24px;
  overflow: visible;
  background: linear-gradient(145deg, rgba(25, 19, 27, 0.96), rgba(14, 12, 18, 0.98));
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 9px;
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
}

.recommendation-heading {
  display: flex;
  margin-bottom: 19px;
  align-items: flex-start;
  gap: 13px;
}

.recommendation-heading__icon {
  display: inline-flex;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  align-items: center;
  justify-content: center;
  color: #eea064;
  background: rgba(157, 66, 35, 0.13);
  border: 1px solid rgba(238, 160, 100, 0.2);
  border-radius: 50%;
}

.recommendation-heading p,
.recommendation-heading h2,
.recommendation-heading span,
.recommendation-check p,
.recommendation-complete p {
  margin: 0;
}

.recommendation-heading p,
.recommendation-game__details > span,
.recommendation-complete span {
  color: rgba(242, 164, 92, 0.7);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.recommendation-heading h2 {
  color: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.015em;
}

.recommendation-heading span {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.game-combobox {
  position: relative;
  z-index: 5;
}

.game-combobox input {
  width: 100%;
  height: 52px;
  padding: 0 48px;
  color: rgba(255, 255, 255, 0.88);
  font:
    600 14px 'Mulish',
    sans-serif;
  outline: none;
  background: rgba(5, 4, 8, 0.46);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.game-combobox input:focus {
  border-color: rgba(238, 160, 100, 0.52);
  box-shadow: 0 0 0 3px rgba(213, 111, 58, 0.08);
}

.game-combobox input::placeholder {
  color: rgba(255, 255, 255, 0.28);
}

.game-combobox__search,
.game-combobox__spinner {
  position: absolute;
  top: 16px;
  z-index: 1;
}

.game-combobox__search {
  left: 17px;
  color: rgba(255, 255, 255, 0.34);
}

.game-combobox__spinner {
  right: 17px;
}

.game-search-results {
  position: absolute;
  bottom: calc(100% + 7px);
  right: 0;
  left: 0;
  max-height: 360px;
  padding: 6px;
  overflow-y: auto;
  background: #151119;
  border: 1px solid rgba(238, 160, 100, 0.2);
  border-radius: 8px;
  box-shadow: 0 22px 55px rgba(0, 0, 0, 0.52);
}

.game-search-results button {
  display: grid;
  width: 100%;
  min-height: 58px;
  padding: 7px;
  grid-template-columns: 96px 1fr auto;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.78);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}

.game-search-results button:hover,
.game-search-results button:focus-visible {
  background: rgba(230, 139, 80, 0.09);
  outline: none;
}

.game-search-results img,
.game-search-results__placeholder {
  width: 96px;
  height: 45px;
  object-fit: cover;
  background: #28202d;
  border-radius: 3px;
}

.game-search-results strong {
  font-size: 13px;
  font-weight: 700;
}

.game-search-results small {
  padding-right: 8px;
  color: rgba(255, 255, 255, 0.28);
  font-size: 9px;
  text-transform: uppercase;
}

.recommendation-check {
  display: grid;
  min-height: 116px;
  margin-top: 14px;
  grid-template-columns: 190px minmax(0, 1fr) auto;
  align-items: center;
  overflow: hidden;
  background: rgba(7, 6, 9, 0.34);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 7px;
}

.recommendation-check--eligible {
  border-color: rgba(117, 185, 128, 0.25);
}

.recommendation-check--blocked {
  border-color: rgba(207, 104, 76, 0.25);
}

.recommendation-check--loading {
  display: flex;
  min-height: 84px;
  padding: 20px;
  justify-content: center;
  gap: 13px;
  color: rgba(255, 255, 255, 0.52);
  font-size: 12px;
}

.recommendation-game__cover {
  width: 100%;
  height: 100%;
  min-height: 116px;
  background-color: #29222e;
  background-position: center;
  background-size: cover;
  box-shadow: inset -34px 0 40px rgba(10, 8, 12, 0.5);
}

.recommendation-game__details {
  min-width: 0;
  padding: 15px 18px;
}

.recommendation-game__details h3 {
  margin: 2px 0 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 18px;
  font-weight: 750;
}

.recommendation-game__details p {
  color: rgba(255, 255, 255, 0.48);
  font-size: 11px;
  line-height: 1.5;
}

.recommendation-game__details a {
  display: inline-flex;
  margin-top: 6px;
  align-items: center;
  gap: 5px;
  color: #d99766;
  font-size: 10px;
  text-decoration: none;
}

.recommendation-game__action {
  display: flex;
  padding: 16px 18px 16px 0;
  align-items: flex-end;
  flex-direction: column;
  gap: 7px;
}

.recommendation-game__action small {
  color: rgba(255, 255, 255, 0.3);
  font-size: 9px;
}

.recommendation-game__action button,
.recommendation-try-another {
  display: inline-flex;
  min-height: 38px;
  padding: 8px 14px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: rgba(255, 255, 255, 0.66);
  font:
    650 11px 'Mulish',
    sans-serif;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 5px;
  cursor: pointer;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.recommendation-game__action button:hover,
.recommendation-game__action button:focus-visible,
.recommendation-try-another:hover,
.recommendation-try-another:focus-visible {
  color: #f4b184;
  background: rgba(242, 164, 92, 0.055);
  border-color: rgba(242, 164, 92, 0.34);
  outline: none;
}

.recommendation-try-another {
  margin-right: 18px;
  color: rgba(255, 255, 255, 0.64);
  background: transparent;
  border-color: rgba(255, 255, 255, 0.14);
}

.recommendation-error,
.recommendation-empty {
  margin: 12px 0 0;
  color: #e7a28e;
  font-size: 12px;
}

.recommendation-empty {
  color: rgba(255, 255, 255, 0.38);
}

.recommendation-complete {
  display: flex;
  min-height: 66px;
  padding: 14px 16px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(6, 5, 8, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 7px;
}

.recommendation-complete {
  justify-content: flex-start;
  color: #8fc899;
}

.recommendation-complete > div {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.recommendation-complete strong {
  color: rgba(255, 255, 255, 0.88);
  font-size: 15px;
  font-weight: 750;
}

.recommendation-complete p {
  color: rgba(255, 255, 255, 0.38);
  font-size: 11px;
}

.recommendation-remove {
  display: inline-flex;
  min-height: 34px;
  padding: 7px 10px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  gap: 6px;
  color: rgba(255, 255, 255, 0.48);
  font:
    650 10px 'Mulish',
    sans-serif;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  cursor: pointer;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.recommendation-remove:hover,
.recommendation-remove:focus-visible {
  color: #e9a18d;
  background: rgba(207, 104, 76, 0.055);
  border-color: rgba(207, 104, 76, 0.3);
  outline: none;
}

.recommendation-remove:disabled {
  cursor: wait;
  opacity: 0.62;
}

@media (max-width: 720px) {
  .recommendation-hearth {
    padding: 18px;
  }

  .recommendation-check {
    grid-template-columns: 1fr;
  }

  .recommendation-game__cover {
    height: 150px;
  }

  .recommendation-game__action {
    padding: 0 18px 18px;
    align-items: stretch;
  }

  .recommendation-game__action small {
    text-align: center;
  }

  .recommendation-complete {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .recommendation-remove {
    width: 100%;
  }

  .recommendation-try-another {
    margin: 0 18px 18px;
  }
}

@media (max-width: 480px) {
  .game-search-results button {
    grid-template-columns: 76px 1fr;
  }

  .game-search-results img,
  .game-search-results__placeholder {
    width: 76px;
    height: 40px;
  }

  .game-search-results small {
    display: none;
  }
}
</style>

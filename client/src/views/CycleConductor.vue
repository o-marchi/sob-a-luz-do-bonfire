<script setup lang="ts">
import axios from 'axios'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useCampaignStore } from '@/stores/campaign'
import BacklogGameCard from '@/components/BacklogGameCard.vue'
import {
  applyCycleTransition,
  cancelCycleElection,
  drawCyclePool,
  getCycleOverview,
  previewCycleTransition,
  startCycleElection,
} from '@/services/cycleService'
import { getGameBacklog } from '@/services/gameService'
import type {
  CycleDraw,
  CycleOverview,
  CycleTransitionInput,
  CycleTransitionPreview,
  ElectionResultOption,
} from '@/types/Cycle'
import type { BacklogGame, Game, GameBacklog } from '@/types/Game'

const PORTUGUESE_MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const auth = useAuthStore()
const { user } = storeToRefs(auth)
const campaignStore = useCampaignStore()
const router = useRouter()
const message = useMessage()

const overview = ref<CycleOverview | null>(null)
const backlog = ref<GameBacklog | null>(null)
const draw = ref<CycleDraw | null>(null)
const transitionPreview = ref<CycleTransitionPreview | null>(null)
const loading = ref(true)
const drawing = ref(false)
const startingElection = ref(false)
const cancellingElection = ref(false)
const confirmingCancellation = ref(false)
const previewing = ref(false)
const applying = ref(false)
const resultsRevealed = ref(false)
const revealCount = ref(0)
const electionEndsAt = ref('')
const winnerGameId = ref<number | undefined>()
const nextMonth = ref('')
const nextYear = ref('')
const meetingAt = ref('')
const description = ref('')
const descriptionEdited = ref(false)
const allowEarlyClose = ref(false)
const discordEnabled = ref(true)
const oldChannelId = ref('')
const discussionCategoryId = ref('')
const historyCategoryId = ref('')
const voiceChannelId = ref('')
const newChannelName = ref('')
const newChannelTopic = ref('')
let revealTimer: number | null = null

const campaign = computed(() => overview.value?.campaign ?? null)
const hasElection = computed(() =>
  Boolean(campaign.value?.electionStartedAt && campaign.value?.pool?.options.length),
)
const guaranteedGames = computed(
  () => draw.value?.guaranteedGames ?? overview.value?.guaranteedGames ?? [],
)
const fillerSlotsNeeded = computed(() =>
  Math.max(0, (overview.value?.targetPoolSize ?? 0) - guaranteedGames.value.length),
)
const revealedGames = computed(() => draw.value?.revealOrder.slice(0, revealCount.value) ?? [])
const allRevealed = computed(() =>
  Boolean(draw.value && revealCount.value >= draw.value.revealOrder.length),
)
const nextMondayDeadline = computed(() => getNextMondayBoundary())
const nextMonthDeadline = computed(
  () =>
    getCampaignMonthBoundary(
      overview.value?.nextCampaign.month,
      overview.value?.nextCampaign.year,
    ) ?? getNextMonthBoundary(),
)
const catalogGamesById = computed(
  () =>
    new Map(
      [...(backlog.value?.games ?? []), ...(backlog.value?.rubble ?? [])].map((game) => [
        game.id,
        game,
      ]),
    ),
)
const retirementThreshold = computed(() => backlog.value?.retirementThreshold ?? 3)
const sortedElectionResult = computed(() =>
  [...(overview.value?.electionResult ?? [])].sort(
    (left, right) => right.tokens - left.tokens || left.game.localeCompare(right.game, 'pt-BR'),
  ),
)
const neutralElectionResult = computed(() =>
  [...(overview.value?.electionResult ?? [])].sort((left, right) =>
    left.game.localeCompare(right.game, 'pt-BR'),
  ),
)
const leadingOptions = computed(() => {
  if (!sortedElectionResult.value.length) return []
  const max = sortedElectionResult.value[0].tokens
  return sortedElectionResult.value.filter((option) => option.tokens === max)
})
const discordPreview = computed(() => transitionPreview.value?.discord ?? null)

onMounted(async () => {
  await auth.init()
  if (!user.value?.isAdmin) {
    message.error('Esta trilha pertence a quem conduz o ciclo.')
    await router.replace('/')
    return
  }
  await loadOverview()
})

onBeforeUnmount(stopReveal)

async function loadOverview() {
  loading.value = true
  try {
    const [loadedOverview, loadedBacklog] = await Promise.all([
      getCycleOverview(),
      getGameBacklog(),
    ])
    overview.value = loadedOverview
    backlog.value = loadedBacklog
    nextMonth.value = loadedOverview.nextCampaign.month
    nextYear.value = loadedOverview.nextCampaign.year
    discordEnabled.value = loadedOverview.discordConfigured
    resultsRevealed.value = false
    setDefaultWinner(loadedOverview.electionResult)
    syncDescriptionWithWinner()

    if (!loadedOverview.campaign.electionStartedAt) {
      electionEndsAt.value = toLocalDateTimeInput(nextMonthDeadline.value)
    }
    if (!meetingAt.value) {
      const nextMeeting = getLastThursdayOfMonth(
        loadedOverview.nextCampaign.month,
        loadedOverview.nextCampaign.year,
        loadedOverview.campaign.meetingAt,
      )
      meetingAt.value = nextMeeting ? toLocalDateTimeInput(nextMeeting) : ''
    }
  } catch (error) {
    message.error(getErrorMessage(error, 'Não foi possível carregar a condução do ciclo.'))
  } finally {
    loading.value = false
  }
}

function asBacklogGame(game: Game): BacklogGame {
  return (
    catalogGamesById.value.get(game.id) ?? {
      ...game,
      electionAppearances: 0,
      guaranteedNextVote: guaranteedGames.value.some((guaranteed) => guaranteed.id === game.id),
      recommendedBy: game.recommendedBy ?? [],
    }
  )
}

function setDefaultWinner(result: ElectionResultOption[]) {
  if (!result.length) return
  const max = Math.max(...result.map((option) => option.tokens))
  const leaders = result.filter((option) => option.tokens === max)
  winnerGameId.value = leaders.length === 1 ? leaders[0].gameId : undefined
}

function syncDescriptionWithWinner() {
  if (descriptionEdited.value) return
  const winner = campaign.value?.pool?.options.find(
    (option) => option.game.id === winnerGameId.value,
  )?.game
  description.value = winner ? buildCampaignPhrase(winner) : ''
}

async function drawGames() {
  stopReveal()
  drawing.value = true
  revealCount.value = 0
  transitionPreview.value = null
  try {
    draw.value = await drawCyclePool()
    draw.value.warnings.forEach((warning) => message.warning(warning))
  } catch (error) {
    message.error(getErrorMessage(error, 'O sorteio não pôde ser realizado.'))
  } finally {
    drawing.value = false
  }
}

function revealNext() {
  if (!draw.value || allRevealed.value) return
  revealCount.value += 1
}

function revealAll() {
  if (!draw.value || allRevealed.value || revealTimer !== null) return
  revealNext()
  revealTimer = window.setInterval(() => {
    revealNext()
    if (allRevealed.value) stopReveal()
  }, 650)
}

function stopReveal() {
  if (revealTimer !== null) {
    window.clearInterval(revealTimer)
    revealTimer = null
  }
}

function setElectionBoundary(boundary: 'monday' | 'month') {
  electionEndsAt.value = toLocalDateTimeInput(
    boundary === 'monday' ? nextMondayDeadline.value : nextMonthDeadline.value,
  )
}

async function openElection() {
  if (!draw.value || !allRevealed.value) return
  startingElection.value = true
  try {
    const updatedCampaign = await startCycleElection(
      draw.value.selectionToken,
      electionEndsAt.value ? toOffsetIso(electionEndsAt.value) : undefined,
    )
    await campaignStore.init(updatedCampaign)
    message.success('A votação está acesa. O grupo já pode votar.')
    draw.value = null
    revealCount.value = 0
    await loadOverview()
  } catch (error) {
    message.error(getErrorMessage(error, 'Não foi possível abrir a votação.'))
  } finally {
    startingElection.value = false
  }
}

async function undoElection() {
  cancellingElection.value = true
  try {
    const updatedCampaign = await cancelCycleElection()
    await campaignStore.init(updatedCampaign)
    confirmingCancellation.value = false
    transitionPreview.value = null
    description.value = ''
    descriptionEdited.value = false
    message.success('A votação foi desfeita. As Brasas voltaram ao lugar.')
    await loadOverview()
  } catch (error) {
    message.error(getErrorMessage(error, 'Não foi possível desfazer a votação.'))
  } finally {
    cancellingElection.value = false
  }
}

function buildTransitionInput(): CycleTransitionInput {
  return {
    winnerGameId: winnerGameId.value,
    month: nextMonth.value,
    year: nextYear.value,
    description: description.value.trim() || undefined,
    meetingAt: meetingAt.value ? toOffsetIso(meetingAt.value) : undefined,
    meetingLocation: 'Discord',
    allowEarlyClose: allowEarlyClose.value,
    discord: {
      enabled: discordEnabled.value,
      oldChannelId: oldChannelId.value || undefined,
      discussionCategoryId: discussionCategoryId.value || undefined,
      historyCategoryId: historyCategoryId.value || undefined,
      voiceChannelId: voiceChannelId.value || undefined,
      newChannelName: newChannelName.value.trim() || undefined,
      newChannelTopic: newChannelTopic.value.trim() || undefined,
    },
  }
}

async function prepareTransition() {
  previewing.value = true
  try {
    transitionPreview.value = await previewCycleTransition(buildTransitionInput())
    syncDiscordSelections(transitionPreview.value)
    if (transitionPreview.value.valid) {
      message.success('A passagem está pronta para sua confirmação.')
    }
  } catch (error) {
    message.error(getErrorMessage(error, 'Não foi possível preparar a passagem.'))
  } finally {
    previewing.value = false
  }
}

function syncDiscordSelections(preview: CycleTransitionPreview) {
  const plan = preview.discord?.plan
  if (!plan) return
  oldChannelId.value ||= plan.oldChannel?.id ?? ''
  discussionCategoryId.value ||= plan.discussionCategory?.id ?? ''
  historyCategoryId.value ||= plan.historyCategory?.id ?? ''
  voiceChannelId.value ||= plan.voiceChannel?.id ?? ''
  newChannelName.value ||= plan.newChannelName
  newChannelTopic.value ||= plan.newChannelTopic
}

async function finishTransition() {
  const token = transitionPreview.value?.confirmationToken
  if (!token) return
  applying.value = true
  try {
    const result = await applyCycleTransition(buildTransitionInput(), token)
    await campaignStore.init(result.campaign)
    message.success(`A campanha de ${result.campaign.month} começou.`)
    transitionPreview.value = null
    description.value = ''
    descriptionEdited.value = false
    await loadOverview()
  } catch (error) {
    message.error(getErrorMessage(error, 'A passagem não pôde ser concluída.'))
  } finally {
    applying.value = false
  }
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getNextMondayBoundary(from = new Date()): Date {
  const boundary = new Date(from)
  boundary.setHours(0, 0, 0, 0)
  const daysUntilMonday = (8 - boundary.getDay()) % 7 || 7
  boundary.setDate(boundary.getDate() + daysUntilMonday)
  return boundary
}

function getNextMonthBoundary(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1, 0, 0, 0, 0)
}

function getCampaignMonthBoundary(month?: string, year?: string): Date | null {
  const monthIndex = PORTUGUESE_MONTHS.findIndex(
    (candidate) =>
      candidate.toLocaleLowerCase('pt-BR') === month?.trim().toLocaleLowerCase('pt-BR'),
  )
  const numericYear = Number(year)
  if (monthIndex < 0 || !Number.isInteger(numericYear)) return null
  return new Date(numericYear, monthIndex, 1, 0, 0, 0, 0)
}

function getLastThursdayOfMonth(
  month: string,
  year: string,
  previousMeetingAt?: string | null,
): Date | null {
  const monthStart = getCampaignMonthBoundary(month, year)
  if (!monthStart) return null
  const meeting = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 20, 0, 0, 0)
  while (meeting.getDay() !== 4) meeting.setDate(meeting.getDate() - 1)

  const previousMeeting = previousMeetingAt ? new Date(previousMeetingAt) : null
  if (previousMeeting && Number.isFinite(previousMeeting.getTime())) {
    meeting.setHours(previousMeeting.getHours(), previousMeeting.getMinutes(), 0, 0)
  }
  return meeting
}

function formatDeadline(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function buildCampaignPhrase(game: Game): string {
  const summary =
    game.summary?.replace(/\s+/g, ' ').trim() || 'Uma nova jornada escolhida ao redor da fogueira.'
  const firstSentence = summary.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()
  const phrase = firstSentence || summary
  if (phrase.length <= 220) return phrase

  const shortened = phrase.slice(0, 219)
  const lastSpace = shortened.lastIndexOf(' ')
  return `${shortened.slice(0, lastSpace > 160 ? lastSpace : 219).trim()}…`
}

function toOffsetIso(localValue: string): string {
  const date = new Date(localValue)
  const pad = (value: number) => String(Math.abs(value)).padStart(2, '0')
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60)
  const offsetRemainder = Math.abs(offsetMinutes) % 60
  return `${localValue}:00${sign}${pad(offsetHours)}:${pad(offsetRemainder)}`
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback
  const payload = error.response?.data as
    | { message?: string | string[]; games?: Array<{ title: string }> }
    | undefined
  const messageValue = Array.isArray(payload?.message)
    ? payload.message.join(' ')
    : payload?.message
  const games = payload?.games?.map((game) => game.title).join(', ')
  return [messageValue || fallback, games].filter(Boolean).join(' ')
}
</script>

<template>
  <section class="cycle-conductor" aria-labelledby="cycle-conductor-heading">
    <div v-if="loading" class="cycle-loading" role="status">Reunindo as brasas do ciclo…</div>

    <template v-else-if="overview && campaign">
      <header class="cycle-hero">
        <div>
          <span class="cycle-eyebrow">Ciclo atual</span>
          <h2 id="cycle-conductor-heading">{{ campaign.month }} de {{ campaign.year }}</h2>
          <p>Componha a votação, acompanhe o resultado e prepare a próxima fogueira.</p>
        </div>
        <div class="cycle-status" :class="{ 'cycle-status--active': campaign.electionActive }">
          <span></span>
          {{
            campaign.electionActive
              ? 'Votação acesa'
              : hasElection
                ? 'Votação encerrada'
                : 'Aguardando sorteio'
          }}
        </div>
      </header>

      <ol class="cycle-steps" aria-label="Etapas da passagem de ciclo">
        <li :class="{ active: !hasElection }"><span>1</span> Compor</li>
        <li :class="{ active: campaign.electionActive }"><span>2</span> Votar</li>
        <li :class="{ active: hasElection && !campaign.electionActive }">
          <span>3</span> Passar a chama
        </li>
      </ol>

      <section v-if="!hasElection" class="cycle-panel cycle-draw-panel">
        <div class="cycle-panel__heading">
          <div>
            <span class="cycle-eyebrow">O sorteio das Brasas</span>
            <h3>Formar a próxima votação</h3>
          </div>
          <strong>
            {{ guaranteedGames.length }}
            {{ guaranteedGames.length === 1 ? 'jogo garantido' : 'jogos garantidos' }}
          </strong>
        </div>

        <p class="cycle-panel__copy">
          Toda sugestão aceita nesta reunião entra na votação, sem limite e sem sorteio. Se houver
          menos de {{ overview.targetPoolSize }}, completamos a roda com jogos elegíveis das Brasas.
        </p>

        <section v-if="guaranteedGames.length" class="guaranteed-selection">
          <header>
            <div>
              <span class="cycle-eyebrow">Presenças confirmadas</span>
              <h4>Estes jogos já estão na próxima votação</h4>
            </div>
            <strong>nenhum deles será removido</strong>
          </header>
          <div class="backlog-grid cycle-catalog-grid">
            <BacklogGameCard
              v-for="game in guaranteedGames"
              :key="game.id"
              :game="asBacklogGame(game)"
              :retirement-threshold="retirementThreshold"
              next-vote
            />
          </div>
        </section>

        <p v-else class="guaranteed-empty">
          Ainda não há sugestões nesta reunião. As cinco vagas virão das Brasas.
        </p>

        <div v-if="!draw" class="draw-hearth">
          <div class="mystery-draw">
            <div v-if="fillerSlotsNeeded" class="mystery-stack" aria-hidden="true">
              <span>?</span><span>?</span><span>?</span>
            </div>
            <span class="cycle-eyebrow">
              {{ fillerSlotsNeeded ? `${fillerSlotsNeeded} lugares em aberto` : 'Roda completa' }}
            </span>
            <h4>
              {{ fillerSlotsNeeded ? 'Quem vem das Brasas?' : 'Nenhum sorteio é necessário' }}
            </h4>
            <p v-if="fillerSlotsNeeded">
              Só estes lugares são surpresa. Os jogos acima já estão a salvo na votação.
            </p>
            <p v-else>As sugestões já formam toda a roda. Vamos apenas conferir e continuar.</p>
            <div class="game-links">
              <button data-testid="draw-games" type="button" :disabled="drawing" @click="drawGames">
                {{
                  drawing
                    ? 'Pesquisando as Brasas…'
                    : fillerSlotsNeeded
                      ? `Sortear ${fillerSlotsNeeded} ${fillerSlotsNeeded === 1 ? 'jogo' : 'jogos'}`
                      : 'Continuar com os sugeridos'
                }}
              </button>
            </div>
          </div>
        </div>

        <template v-else>
          <section v-if="draw.selectedFillers.length" class="random-selection">
            <header>
              <span class="cycle-eyebrow">Vindos das Brasas</span>
              <strong>
                {{ draw.selectedFillers.length }}
                {{ draw.selectedFillers.length === 1 ? 'jogo sorteado' : 'jogos sorteados' }}
              </strong>
            </header>
            <div
              class="backlog-grid cycle-catalog-grid cycle-catalog-grid--reveal"
              aria-live="polite"
            >
              <div
                v-for="(game, index) in revealedGames"
                :key="game.id"
                class="cycle-catalog-card"
                :style="{ '--reveal-index': index }"
              >
                <BacklogGameCard
                  :game="asBacklogGame(game)"
                  :retirement-threshold="retirementThreshold"
                />
              </div>

              <button
                v-if="!allRevealed"
                class="reveal-card reveal-card--hidden cycle-catalog-mystery"
                type="button"
                @click="revealNext"
              >
                <span>?</span>
                <strong>
                  Qual é a
                  {{ revealedGames.length ? 'próxima' : 'primeira' }} brasa?
                </strong>
              </button>
            </div>

            <div class="draw-actions game-links">
              <button v-if="!allRevealed" type="button" @click="revealAll">
                Revelar em sequência
              </button>
              <button type="button" :disabled="drawing" @click="drawGames">
                {{ drawing ? 'Sorteando…' : 'Sortear novamente' }}
              </button>
            </div>
          </section>

          <p v-else class="random-selection__empty">
            A votação será formada somente pelas sugestões confirmadas acima.
          </p>

          <div v-if="allRevealed" class="election-launch">
            <div>
              <span class="cycle-eyebrow">A roda está formada</span>
              <h3>Quando as urnas se fecham?</h3>
              <p>Você pode deixar sem prazo e encerrar manualmente depois.</p>
            </div>
            <div class="duration-presets game-links">
              <button type="button" @click="setElectionBoundary('monday')">
                Virada para segunda · {{ formatDeadline(nextMondayDeadline) }}
              </button>
              <button type="button" @click="setElectionBoundary('month')">
                Virada do mês · {{ formatDeadline(nextMonthDeadline) }}
              </button>
            </div>
            <label class="cycle-field">
              <span>Encerramento opcional</span>
              <input v-model="electionEndsAt" type="datetime-local" />
            </label>
            <div class="game-links">
              <button
                data-testid="start-election"
                type="button"
                :disabled="startingElection"
                @click="openElection"
              >
                {{ startingElection ? 'Acendendo a votação…' : 'Começar a eleição' }}
              </button>
            </div>
          </div>
        </template>
      </section>

      <section v-else class="cycle-panel cycle-transition-panel">
        <div class="cycle-panel__heading">
          <div>
            <span class="cycle-eyebrow">O pulso da votação</span>
            <h3>Preparar a próxima campanha</h3>
          </div>
          <strong v-if="campaign.electionEndsAt && campaign.electionActive">
            até {{ new Date(campaign.electionEndsAt).toLocaleString('pt-BR') }}
          </strong>
          <strong v-else-if="campaign.electionActive">encerramento manual</strong>
          <strong v-else>votação encerrada</strong>
        </div>

        <div v-if="!resultsRevealed" class="results-privacy">
          <div>
            <span class="cycle-eyebrow">Contagem protegida</span>
            <h4>Os resultados estão ocultos</h4>
            <p>
              Os jogos continuam visíveis em ordem alfabética. Ranking, tokens, votos e liderança só
              aparecem quando você decidir revelar.
            </p>
          </div>
          <div class="game-links">
            <button data-testid="reveal-results" type="button" @click="resultsRevealed = true">
              Revelar resultados
            </button>
          </div>
        </div>

        <div v-if="resultsRevealed" class="results-revealed-actions game-links">
          <button type="button" @click="resultsRevealed = false">Ocultar resultados</button>
        </div>

        <div class="result-list">
          <label
            v-for="(option, index) in resultsRevealed
              ? sortedElectionResult
              : neutralElectionResult"
            :key="option.gameId"
            class="result-row"
            :class="{ 'result-row--leader': resultsRevealed && index === 0 }"
          >
            <input
              v-if="
                resultsRevealed &&
                leadingOptions.length > 1 &&
                option.tokens === leadingOptions[0]?.tokens
              "
              v-model="winnerGameId"
              type="radio"
              :value="option.gameId"
              @change="syncDescriptionWithWinner"
            />
            <span v-if="resultsRevealed" class="result-row__rank">{{ index + 1 }}</span>
            <strong>{{ option.game }}</strong>
            <template v-if="resultsRevealed">
              <span>{{ option.tokens }} {{ option.tokens === 1 ? 'token' : 'tokens' }}</span>
              <small>{{ option.voters.length }} votos</small>
            </template>
          </label>
        </div>

        <aside class="cycle-undo" :class="{ 'cycle-undo--open': confirmingCancellation }">
          <template v-if="!confirmingCancellation">
            <div>
              <strong>Abriu a votação sem querer?</strong>
              <span>Você pode voltar às Brasas e fazer outro sorteio.</span>
            </div>
            <div class="game-links">
              <button type="button" @click="confirmingCancellation = true">
                Desfazer abertura
              </button>
            </div>
          </template>
          <template v-else>
            <div>
              <strong>Apagar esta votação?</strong>
              <span>O pool será removido e os votos já registrados serão descartados.</span>
            </div>
            <div class="cycle-undo__actions game-links">
              <button
                type="button"
                :disabled="cancellingElection"
                @click="confirmingCancellation = false"
              >
                Manter votação
              </button>
              <button
                data-testid="confirm-cancel-election"
                type="button"
                :disabled="cancellingElection"
                @click="undoElection"
              >
                {{ cancellingElection ? 'Desfazendo…' : 'Sim, desfazer' }}
              </button>
            </div>
          </template>
        </aside>

        <p v-if="resultsRevealed && leadingOptions.length > 1" class="cycle-warning">
          Empate na liderança. Escolha acima qual jogo recebe a chama.
        </p>

        <form class="transition-form" @submit.prevent="prepareTransition">
          <div class="transition-form__grid">
            <label class="cycle-field">
              <span>Mês</span>
              <input v-model="nextMonth" required />
            </label>
            <label class="cycle-field">
              <span>Ano</span>
              <input v-model="nextYear" required />
            </label>
            <label class="cycle-field">
              <span>Próximo encontro</span>
              <input v-model="meetingAt" type="datetime-local" />
            </label>
          </div>

          <label class="cycle-field">
            <span>
              Frase da campanha
              <small>preenchida com o resumo curto salvo do jogo vencedor</small>
            </span>
            <textarea
              v-model="description"
              rows="3"
              maxlength="240"
              placeholder="Uma frase curta sobre esta jornada."
              @input="descriptionEdited = true"
            ></textarea>
          </label>

          <label class="cycle-check">
            <input v-model="discordEnabled" type="checkbox" />
            <span>
              <strong>Organizar o Discord junto</strong>
              Arquivar a conversa atual, abrir a nova e criar o evento do encontro.
            </span>
          </label>

          <p v-if="discordEnabled && !overview.discordConfigured" class="cycle-warning">
            O bot ainda não está configurado no servidor. A prévia mostrará o que falta.
          </p>

          <label
            v-if="campaign.electionActive && campaign.electionEndsAt"
            class="cycle-check cycle-check--caution"
          >
            <input v-model="allowEarlyClose" type="checkbox" />
            <span>Permitir encerrar antes do horário programado.</span>
          </label>

          <div class="transition-form__actions game-links">
            <button type="submit" :disabled="previewing || !winnerGameId">
              {{ previewing ? 'Lendo a passagem…' : 'Revisar a passagem' }}
            </button>
          </div>
        </form>

        <div v-if="discordPreview && discordEnabled" class="discord-controls">
          <h4>Ajustes do Discord</h4>
          <div class="transition-form__grid">
            <label class="cycle-field">
              <span>Conversa atual</span>
              <select v-model="oldChannelId">
                <option value="">Selecionar</option>
                <option
                  v-for="channel in discordPreview.channels.text"
                  :key="channel.id"
                  :value="channel.id"
                >
                  #{{ channel.name }}
                </option>
              </select>
            </label>
            <label class="cycle-field">
              <span>Categoria das conversas</span>
              <select v-model="discussionCategoryId">
                <option value="">Manter posição atual</option>
                <option
                  v-for="category in discordPreview.channels.categories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.name }}
                </option>
              </select>
            </label>
            <label class="cycle-field">
              <span>Histórias da Fogueira</span>
              <select v-model="historyCategoryId">
                <option value="">Criar automaticamente</option>
                <option
                  v-for="category in discordPreview.channels.categories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.name }}
                </option>
              </select>
            </label>
            <label class="cycle-field">
              <span>Canal de voz</span>
              <select v-model="voiceChannelId">
                <option value="">Selecionar</option>
                <option
                  v-for="channel in discordPreview.channels.voice"
                  :key="channel.id"
                  :value="channel.id"
                >
                  {{ channel.name }}
                </option>
              </select>
            </label>
            <label class="cycle-field">
              <span>Novo canal</span>
              <input v-model="newChannelName" />
            </label>
            <label class="cycle-field">
              <span>Tópico</span>
              <input v-model="newChannelTopic" />
            </label>
          </div>
          <div class="game-links">
            <button type="button" :disabled="previewing" @click="prepareTransition">
              {{ previewing ? 'Atualizando…' : 'Atualizar prévia' }}
            </button>
          </div>
        </div>

        <section v-if="transitionPreview" class="transition-preview" aria-live="polite">
          <div
            v-if="transitionPreview.errors.length"
            class="preview-notices preview-notices--error"
          >
            <strong>A passagem ainda precisa de atenção</strong>
            <ul>
              <li v-for="error in transitionPreview.errors" :key="error">{{ error }}</li>
            </ul>
          </div>
          <div v-if="transitionPreview.warnings.length" class="preview-notices">
            <strong>Antes de confirmar</strong>
            <ul>
              <li v-for="warning in transitionPreview.warnings" :key="warning">{{ warning }}</li>
            </ul>
          </div>

          <template v-if="transitionPreview.campaign">
            <span class="cycle-eyebrow">Prévia da nova chama</span>
            <h3>{{ transitionPreview.campaign.month }} · {{ transitionPreview.winner?.title }}</h3>
            <pre>{{ transitionPreview.campaign.description }}</pre>

            <ul v-if="transitionPreview.discord?.enabled" class="discord-plan-list">
              <li>
                Arquivar #{{
                  transitionPreview.discord.plan.oldChannel?.name || 'canal a selecionar'
                }}
              </li>
              <li>
                {{ transitionPreview.discord.plan.createHistoryCategory ? 'Criar' : 'Usar' }}
                Histórias da Fogueira
              </li>
              <li>Abrir #{{ transitionPreview.discord.plan.newChannelName }}</li>
              <li>
                Publicar o card “{{ transitionPreview.discord.plan.gameCard.title }}” com:
                {{ transitionPreview.discord.plan.gameCard.description }}
              </li>
              <li v-if="transitionPreview.discord.plan.eventName">
                Agendar “{{ transitionPreview.discord.plan.eventName }}”
              </li>
            </ul>
          </template>

          <div
            v-if="transitionPreview.valid && transitionPreview.confirmationToken"
            class="game-links"
          >
            <button type="button" :disabled="applying" @click="finishTransition">
              {{ applying ? 'Passando a chama…' : 'Encerrar este ciclo e começar o próximo' }}
            </button>
          </div>
        </section>
      </section>
    </template>
  </section>
</template>

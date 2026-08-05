<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { LogoSteam, LogoYoutube, TimeOutline } from '@vicons/ionicons5'
import { NIcon, NModal, NSpin, NTooltip } from 'naive-ui'
import { formatDurationLabel, getGameBacklog, getGameCover } from '@/services/gameService'
import type { BacklogGame, GameBacklog, GameRecommender } from '@/types/Game'
import BacklogGameCard from '@/components/BacklogGameCard.vue'
import { useAuthStore } from '@/stores/auth'

const { user } = storeToRefs(useAuthStore())

const backlog = ref<GameBacklog | null>(null)
const loading = ref(true)
const loadFailed = ref(false)
const rubbleShuffling = ref(false)
const extractedRubbleIndex = ref<number | null>(null)
const selectedRubbleGame = ref<BacklogGame | null>(null)
const rubbleModalOpen = ref(false)
const failedRecommenderAvatars = ref(new Set<string>())

const backlogCountLabel = computed(() => {
  const count = backlog.value?.games.length ?? 0
  return `${count} ${count === 1 ? 'jogo' : 'jogos'} à espera da fogueira`
})

const isGuaranteedNextVote = (game: BacklogGame) => game.guaranteedNextVote

const nextVoteGames = computed(() => backlog.value?.games.filter(isGuaranteedNextVote) ?? [])

const returningGames = computed(
  () => backlog.value?.games.filter((game) => !isGuaranteedNextVote(game)) ?? [],
)

const appearanceLabel = (count: number) => {
  if (count === 0) return 'Ainda não passou'
  return `${count} ${count === 1 ? 'passagem' : 'passagens'}`
}

const coverStyle = (game: BacklogGame) => ({
  backgroundImage: getGameCover(game) ? `url('${getGameCover(game)}')` : undefined,
})

const recommenderAvatarKey = (gameId: number, recommenderId: number) => `${gameId}:${recommenderId}`

const hasRecommenderAvatar = (game: BacklogGame, recommender: GameRecommender) =>
  Boolean(recommender.avatar) &&
  !failedRecommenderAvatars.value.has(recommenderAvatarKey(game.id, recommender.id))

const markRecommenderAvatarFailed = (game: BacklogGame, recommender: GameRecommender) => {
  failedRecommenderAvatars.value = new Set(failedRecommenderAvatars.value).add(
    recommenderAvatarKey(game.id, recommender.id),
  )
}

const recommenderInitial = (recommender: GameRecommender) =>
  recommender.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || '?'

const visibleRecommenders = (game: BacklogGame) => (game.recommendedBy ?? []).slice(0, 3)

const hiddenRecommenderNames = (game: BacklogGame) =>
  (game.recommendedBy ?? [])
    .slice(3)
    .map((recommender) => recommender.name)
    .join(', ')

interface RubblePieceLayout {
  style: Record<string, string>
  top: number
}

interface RubblePileLayout {
  height: number
  pieces: RubblePieceLayout[]
}

const viewportWidth = ref(1280)
const rubbleLayoutWidth = ref(1280)
const rubbleSeed = Math.floor(Math.random() * 0xffffffff)
let resizeFrame: number | undefined
let resizeTimer: number | undefined
let extractionTimer: number | undefined

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const createDamageMask = (random: () => number, damage: number) => {
  const tear = (minimum: number, range: number) => minimum + random() * range * damage

  return `polygon(
    ${tear(0, 10)}% ${tear(0, 17)}%,
    ${tear(19, 13)}% ${tear(0, 8)}%,
    ${tear(48, 12)}% ${tear(0, 14)}%,
    ${tear(76, 12)}% ${tear(0, 10)}%,
    ${100 - tear(0, 9)}% ${tear(1, 22)}%,
    ${100 - tear(0, 12)}% ${tear(65, 20)}%,
    ${100 - tear(4, 20)}% ${100 - tear(0, 14)}%,
    ${tear(53, 17)}% ${100 - tear(0, 12)}%,
    ${tear(20, 20)}% ${100 - tear(0, 17)}%,
    ${tear(0, 12)}% ${100 - tear(5, 22)}%
  )`
}

const createRubbleLayout = (total: number, availableWidth: number): RubblePileLayout => {
  if (!total) return { height: 360, pieces: [] }

  const width = Math.max(320, availableWidth)
  const mobile = width < 640
  const random = createSeededRandom(rubbleSeed + (mobile ? 1 : 0))
  const baseWidth = mobile ? clamp(width * 0.78, 258, 310) : clamp(width * 0.215, 285, 320)
  const groundCount = Math.min(total, Math.max(2, Math.round(width / (baseWidth * 0.92))))
  const surfaceBinCount = Math.max(18, Math.ceil(width / (mobile ? 18 : 24)))
  const surface = Array.from<number>({ length: surfaceBinCount }).fill(0)
  const pieces: RubblePieceLayout[] = []

  const surfaceRange = (left: number, pieceWidth: number) => {
    const first = clamp(
      Math.floor(((left - pieceWidth * 0.38) / width) * (surfaceBinCount - 1)),
      0,
      surfaceBinCount - 1,
    )
    const last = clamp(
      Math.ceil(((left + pieceWidth * 0.38) / width) * (surfaceBinCount - 1)),
      first,
      surfaceBinCount - 1,
    )

    return { first, last }
  }

  const getSupport = (left: number, pieceWidth: number) => {
    const { first, last } = surfaceRange(left, pieceWidth)
    const values = surface.slice(first, last + 1).sort((a, b) => a - b)
    const support = values[Math.floor((values.length - 1) * 0.56)] ?? 0

    return { first, last, support }
  }

  const updateSurface = (first: number, last: number, bottom: number, pieceHeight: number) => {
    const middle = (first + last) / 2
    const radius = Math.max(1, (last - first) / 2)

    for (let bin = first; bin <= last; bin += 1) {
      const distance = Math.min(1, Math.abs(bin - middle) / radius)
      const top = bottom + pieceHeight * (0.79 + Math.cos(distance * Math.PI * 0.5) * 0.21)
      surface[bin] = Math.max(surface[bin] ?? 0, top)
    }
  }

  for (let index = 0; index < total; index += 1) {
    const groundPiece = index < groundCount
    const damage = 0.2 + random() * 0.8
    const pieceWidth = clamp(
      baseWidth * (0.92 + random() * 0.16),
      mobile ? 250 : 275,
      mobile ? Math.min(325, width * 0.88) : 340,
    )
    const pieceHeight = clamp(pieceWidth * (0.56 + random() * 0.1), 158, mobile ? 218 : 225)
    let left: number
    let supportData: ReturnType<typeof getSupport>

    if (groundPiece) {
      const slotWidth = width / groundCount
      left = slotWidth * (index + 0.5) + (random() - 0.5) * slotWidth * 0.12
      supportData = getSupport(left, Math.max(pieceWidth, slotWidth * 1.12))
    } else {
      const progress = (index - groundCount) / Math.max(1, total - groundCount - 1)
      const spread = 1 - progress * 0.18
      let bestCandidate = width / 2
      let bestScore = Number.NEGATIVE_INFINITY

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const triangular = random() + random() - 1
        const candidate = clamp(width / 2 + triangular * width * 0.57 * spread, 0, width)
        const candidateSupport = getSupport(candidate, pieceWidth).support
        const centrality = 1 - Math.abs(candidate - width / 2) / (width / 2)
        const score =
          centrality * baseWidth * (0.28 + progress * 0.18) -
          candidateSupport * 0.58 +
          random() * 36

        if (score > bestScore) {
          bestScore = score
          bestCandidate = candidate
        }
      }

      left = bestCandidate
      supportData = getSupport(left, pieceWidth)
    }

    const bottom = groundPiece
      ? -16 + random() * 18
      : Math.max(8, supportData.support - pieceHeight * (0.4 + random() * 0.1))
    const leftSupport = surface[supportData.first] ?? 0
    const rightSupport = surface[supportData.last] ?? 0
    const surfaceAngle = Math.atan2(rightSupport - leftSupport, pieceWidth) * (180 / Math.PI)
    const rotation = surfaceAngle * 0.45 + (random() - 0.5) * (damage > 0.76 ? 13 : 7)
    const top = bottom + pieceHeight

    pieces.push({
      top,
      style: {
        left: `${(left / width) * 100}%`,
        bottom: `${bottom}px`,
        width: `${pieceWidth}px`,
        height: `${pieceHeight}px`,
        clipPath: createDamageMask(random, damage),
        '--rubble-rotation': `${rotation}deg`,
        '--rubble-layer': String(10 + index),
        '--rubble-brightness': String(0.34 + (1 - damage) * 0.18 + random() * 0.06),
        '--rubble-saturation': String(0.08 + (1 - damage) * 0.18),
        '--rubble-damage-opacity': String(0.2 + damage * 0.68),
        '--rubble-scar-angle': `${18 + random() * 125}deg`,
        '--rubble-scar-x': `${15 + random() * 70}%`,
        '--rubble-scar-y': `${12 + random() * 64}%`,
      },
    })

    updateSurface(supportData.first, supportData.last, bottom, pieceHeight)
  }

  const pileHeight = Math.max(360, ...pieces.map((piece) => piece.top + 34))

  return { height: pileHeight, pieces }
}

const displayedRubbleCount = computed(() => (backlog.value?.rubble.length ?? 0) * 3)
const rubbleLayout = computed(() =>
  createRubbleLayout(displayedRubbleCount.value, rubbleLayoutWidth.value),
)

const rubblePileStyle = computed(() => ({
  '--rubble-pile-height': `${rubbleLayout.value.height}px`,
}))

const rubbleSectionStyle = computed(() => ({
  '--rubble-viewport-width': `${viewportWidth.value}px`,
}))

const rubblePlacement = (game: BacklogGame, index: number): Record<string, string> => ({
  backgroundImage: getGameCover(game) ? `url('${getGameCover(game)}')` : 'none',
  ...rubbleLayout.value.pieces[index]?.style,
})

const openRubbleGame = (game: BacklogGame, index: number) => {
  if (extractedRubbleIndex.value !== null) return

  extractedRubbleIndex.value = index
  selectedRubbleGame.value = game
  extractionTimer = window.setTimeout(() => {
    rubbleModalOpen.value = true
    extractionTimer = undefined
  }, 220)
}

const restoreRubbleGame = () => {
  extractedRubbleIndex.value = null
  selectedRubbleGame.value = null
}

const updateViewportWidth = () => {
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
  resizeFrame = window.requestAnimationFrame(() => {
    const nextWidth = document.documentElement.clientWidth
    const crossedMobileBreakpoint =
      (rubbleLayoutWidth.value < 640 && nextWidth >= 640) ||
      (rubbleLayoutWidth.value >= 640 && nextWidth < 640)

    viewportWidth.value = nextWidth

    const requiresReshuffle =
      crossedMobileBreakpoint || Math.abs(nextWidth - rubbleLayoutWidth.value) > 220

    if (requiresReshuffle) {
      rubbleShuffling.value = true
      if (resizeTimer) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(async () => {
        rubbleLayoutWidth.value = document.documentElement.clientWidth
        resizeTimer = undefined
        await nextTick()
        window.requestAnimationFrame(() => {
          rubbleShuffling.value = false
        })
      }, 240)
    } else if (resizeTimer) {
      window.clearTimeout(resizeTimer)
      resizeTimer = undefined
      rubbleShuffling.value = false
    }
  })
}

const loadBacklog = async () => {
  loading.value = true
  loadFailed.value = false

  try {
    backlog.value = await getGameBacklog()
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
    updateViewportWidth()
  }
}

onMounted(() => {
  const initialWidth = document.documentElement.clientWidth
  viewportWidth.value = initialWidth
  rubbleLayoutWidth.value = initialWidth
  window.addEventListener('resize', updateViewportWidth, { passive: true })
  void loadBacklog()
})

onBeforeUnmount(() => {
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
  if (resizeTimer) window.clearTimeout(resizeTimer)
  if (extractionTimer) window.clearTimeout(extractionTimer)
  window.removeEventListener('resize', updateViewportWidth)
})
</script>

<template>
  <section class="backlog-page" aria-label="Brasas">
    <n-modal
      v-model:show="rubbleModalOpen"
      :block-scroll="false"
      :mask-closable="true"
      transform-origin="center"
      @after-leave="restoreRubbleGame"
    >
      <div v-if="selectedRubbleGame && backlog" class="rubble-memory-position">
        <article
          class="backlog-card rubble-memory-card"
          :aria-label="`Lembrança de ${selectedRubbleGame.title}`"
        >
          <div class="backlog-card__art" :style="coverStyle(selectedRubbleGame)">
            <div class="backlog-card__shade"></div>

            <span class="backlog-card__count">
              <strong>{{ selectedRubbleGame.electionAppearances }}</strong>
              / {{ backlog.retirementThreshold }}
            </span>

            <header class="backlog-card__title">
              <h3>{{ selectedRubbleGame.title }}</h3>
            </header>
          </div>

          <footer class="backlog-card__footer">
            <div class="backlog-card__history">
              <div
                class="backlog-embers"
                :aria-label="appearanceLabel(selectedRubbleGame.electionAppearances)"
              >
                <span
                  v-for="position in backlog.retirementThreshold"
                  :key="position"
                  :class="{
                    'backlog-ember--lit': position <= selectedRubbleGame.electionAppearances,
                  }"
                  aria-hidden="true"
                ></span>
              </div>
              <span>{{ appearanceLabel(selectedRubbleGame.electionAppearances) }}</span>
            </div>

            <div
              v-if="selectedRubbleGame.recommendedBy?.length"
              class="backlog-card__recommenders"
              aria-label="Pessoas que apresentaram este jogo ao grupo"
            >
              <n-tooltip
                v-for="recommender in visibleRecommenders(selectedRubbleGame)"
                :key="recommender.id"
                placement="top"
              >
                <template #trigger>
                  <span
                    class="backlog-recommender"
                    tabindex="0"
                    :aria-label="`Apresentado por ${recommender.name}`"
                  >
                    <img
                      v-if="hasRecommenderAvatar(selectedRubbleGame, recommender)"
                      :src="recommender.avatar ?? undefined"
                      alt=""
                      @error="markRecommenderAvatarFailed(selectedRubbleGame, recommender)"
                    />
                    <span v-else aria-hidden="true">{{ recommenderInitial(recommender) }}</span>
                  </span>
                </template>
                Apresentado por {{ recommender.name }}
              </n-tooltip>

              <n-tooltip v-if="selectedRubbleGame.recommendedBy.length > 3" placement="top">
                <template #trigger>
                  <span
                    class="backlog-recommender backlog-recommender--more"
                    tabindex="0"
                    :aria-label="`Mais ${selectedRubbleGame.recommendedBy.length - 3} pessoas apresentaram este jogo`"
                  >
                    +{{ selectedRubbleGame.recommendedBy.length - 3 }}
                  </span>
                </template>
                Também apresentado por {{ hiddenRecommenderNames(selectedRubbleGame) }}
              </n-tooltip>
            </div>

            <nav class="backlog-card__links" :aria-label="`Links de ${selectedRubbleGame.title}`">
              <a
                v-if="selectedRubbleGame.steam"
                :href="selectedRubbleGame.steam"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir na Steam"
              >
                <n-icon size="17"><LogoSteam /></n-icon>
              </a>
              <a
                v-if="selectedRubbleGame.trailer"
                :href="selectedRubbleGame.trailer"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Assistir ao trailer"
              >
                <n-icon size="17"><LogoYoutube /></n-icon>
              </a>
              <a
                v-if="selectedRubbleGame.howLongToBeatUrl"
                :href="selectedRubbleGame.howLongToBeatUrl"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="`Ver duração${formatDurationLabel(selectedRubbleGame.durationLabel) ? `: ${formatDurationLabel(selectedRubbleGame.durationLabel)}` : ''}`"
              >
                <n-icon size="17"><TimeOutline /></n-icon>
              </a>
            </nav>
          </footer>
        </article>
      </div>
    </n-modal>

    <div v-if="loading" class="main-block backlog-loading" role="status" aria-live="polite">
      <n-spin :size="34" :stroke-width="12" stroke="#e7a06c" />
      <span>Avivando as brasas…</span>
    </div>

    <div v-else-if="loadFailed" class="main-block backlog-empty backlog-empty--error">
      <span class="backlog-eyebrow">A chama baixou</span>
      <h2>Não conseguimos carregar as Brasas</h2>
      <p>Podemos tentar reunir os jogos novamente.</p>
      <button type="button" class="backlog-retry" @click="loadBacklog">Tentar novamente</button>
    </div>

    <template v-else-if="backlog && (backlog.games.length || backlog.rubble.length)">
      <header class="backlog-overview">
        <div class="backlog-overview__copy">
          <span class="backlog-eyebrow">Ainda há calor</span>
          <h2 id="backlog-heading">{{ backlogCountLabel }}</h2>
          <p>
            Jogos sugeridos que ainda podem ser escolhidos para uma jornada. Cada um ainda guarda a
            chance de ganhar um lugar junto à fogueira.
          </p>
        </div>

        <div class="backlog-overview__aside">
          <div class="backlog-limit" aria-label="Limite de passagens antes de virar cinza">
            <strong>{{ backlog.retirementThreshold }}</strong>
            <span>passagens<br />até as cinzas</span>
          </div>

          <RouterLink v-if="user?.isAdmin" class="backlog-conductor-link" to="/conduzir">
            <span>Próxima votação</span>
            <strong>Conduzir o ciclo →</strong>
          </RouterLink>
        </div>
      </header>

      <section
        v-if="nextVoteGames.length"
        class="backlog-shelf backlog-shelf--next-vote"
        aria-labelledby="next-vote-heading"
      >
        <header class="backlog-shelf__heading">
          <div>
            <span class="backlog-eyebrow">Lugar garantido</span>
            <h2 id="next-vote-heading">Na próxima votação</h2>
          </div>
          <p>Estas sugestões já estão confirmadas para a próxima rodada.</p>
        </header>

        <div class="backlog-grid backlog-grid--next-vote">
          <BacklogGameCard
            v-for="game in nextVoteGames"
            :key="game.id"
            :game="game"
            :retirement-threshold="backlog.retirementThreshold"
            next-vote
          />

          <article v-if="backlog.nextVoteFillCount" class="next-vote-fill-card">
            <span class="next-vote-fill-card__count">+{{ backlog.nextVoteFillCount }}</span>
            <div>
              <h3>
                {{ backlog.nextVoteFillCount === 1 ? 'jogo das Brasas' : 'jogos das Brasas' }}
              </h3>
              <p>
                para chegar o mais perto possível de {{ backlog.targetPoolSize }} jogos na votação
              </p>
            </div>
          </article>
        </div>
      </section>

      <section
        v-if="returningGames.length"
        class="backlog-shelf"
        :aria-labelledby="nextVoteGames.length ? 'returning-games-heading' : undefined"
        :aria-label="nextVoteGames.length ? undefined : 'Jogos que ainda guardam calor'"
      >
        <header v-if="nextVoteGames.length" class="backlog-shelf__heading">
          <div>
            <span class="backlog-eyebrow">Ainda nas Brasas</span>
            <h2 id="returning-games-heading">Outros jogos nas Brasas</h2>
          </div>
          <p>Jogos que continuam disponíveis para as próximas rodadas.</p>
        </header>

        <div class="backlog-grid" aria-label="Jogos que ainda guardam calor">
          <BacklogGameCard
            v-for="game in returningGames"
            :key="game.id"
            :game="game"
            :retirement-threshold="backlog.retirementThreshold"
          />
        </div>
      </section>

      <section
        v-if="backlog.rubble.length"
        class="backlog-rubble"
        aria-label="Jogos que viraram cinza"
        :style="rubbleSectionStyle"
      >
        <h2 class="backlog-rubble__title">Cinzas</h2>

        <div
          class="backlog-rubble__pile"
          :class="{ 'backlog-rubble__pile--shuffling': rubbleShuffling }"
          :style="rubblePileStyle"
        >
          <button
            v-for="(game, index) in backlog.rubble"
            :key="`${game.id}-${index}`"
            type="button"
            class="backlog-rubble__piece"
            :class="{
              'backlog-rubble__piece--extracted': extractedRubbleIndex === index,
            }"
            :style="rubblePlacement(game, index)"
            :aria-label="`${game.title}, ${game.electionAppearances} passagens sem ser escolhido. Ver lembrança`"
            @click="openRubbleGame(game, index)"
          >
            <span>{{ game.electionAppearances }} passagens</span>
            <strong>{{ game.title }}</strong>
          </button>
        </div>
      </section>
    </template>

    <div v-else class="main-block backlog-empty">
      <span class="backlog-eyebrow">Nenhuma brasa por aqui</span>
      <h2>Nenhum jogo está esperando</h2>
      <p>As próximas sugestões vão aparecer aqui quando chegarem à fogueira.</p>
    </div>
  </section>
</template>

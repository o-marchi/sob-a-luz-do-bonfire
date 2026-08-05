import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CycleConductor from '@/views/CycleConductor.vue'
import { useAuthStore } from '@/stores/auth'
import { useCampaignStore } from '@/stores/campaign'

const cycleServiceMocks = vi.hoisted(() => ({
  getCycleOverview: vi.fn(),
  drawCyclePool: vi.fn(),
  startCycleElection: vi.fn(),
  cancelCycleElection: vi.fn(),
  previewCycleTransition: vi.fn(),
  applyCycleTransition: vi.fn(),
}))
const gameServiceMocks = vi.hoisted(() => ({
  getGameBacklog: vi.fn(),
}))
const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('@/services/cycleService', () => cycleServiceMocks)
vi.mock('@/services/gameService', () => ({
  getGameBacklog: gameServiceMocks.getGameBacklog,
  getGameCover: vi.fn(() => ''),
  formatDurationLabel: vi.fn((label?: string | null) => label ?? ''),
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('naive-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('naive-ui')>()),
  useMessage: () => messageMocks,
}))

describe('CycleConductor', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.user = { id: 1, name: 'Conductor', isAdmin: true }
    auth.isAuthenticated = true
    auth.loading = false
    vi.spyOn(auth, 'init').mockResolvedValue()
    vi.spyOn(useCampaignStore(), 'init').mockResolvedValue()

    cycleServiceMocks.getCycleOverview.mockResolvedValue({
      campaign: {
        id: 17,
        month: 'Agosto',
        year: '2026',
        current: true,
        electionActive: false,
        pool: null,
      },
      guaranteedGames: [{ id: 1, title: 'Suggested Game', suggestion: true }],
      electionResult: [],
      targetPoolSize: 5,
      nextCampaign: { month: 'Setembro', year: '2026' },
      discordConfigured: true,
    })
    gameServiceMocks.getGameBacklog.mockResolvedValue({
      games: [
        {
          id: 1,
          title: 'Suggested Game',
          suggestion: true,
          electionAppearances: 2,
          guaranteedNextVote: true,
          recommendedBy: [{ id: 7, name: 'Ana', avatar: null }],
        },
        {
          id: 2,
          title: 'Random Game',
          suggestion: true,
          electionAppearances: 1,
          guaranteedNextVote: false,
          recommendedBy: [{ id: 8, name: 'Bia', avatar: null }],
        },
      ],
      rubble: [],
      retirementThreshold: 3,
      targetPoolSize: 5,
      nextVoteFillCount: 4,
    })
    cycleServiceMocks.drawCyclePool.mockResolvedValue({
      campaignId: 17,
      targetPoolSize: 5,
      guaranteedGames: [{ id: 1, title: 'Suggested Game', suggestion: true }],
      selectedFillers: [{ id: 2, title: 'Random Game', suggestion: true }],
      revealOrder: [{ id: 2, title: 'Random Game', suggestion: true, mainExtraHours: 10 }],
      excludedUnverified: [],
      selectionToken: 'signed-draw',
      warnings: [],
    })
    cycleServiceMocks.startCycleElection.mockResolvedValue({
      id: 17,
      month: 'Agosto',
      year: '2026',
      current: true,
      electionActive: true,
      electionStartedAt: '2026-08-05T20:00:00-03:00',
      pool: { options: [] },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows guaranteed suggestions first and reveals only the random selection', async () => {
    const wrapper = mount(CycleConductor, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Formar a próxima votação')
    expect(wrapper.text()).toContain('Suggested Game')
    expect(wrapper.text()).toContain('nenhum deles será removido')
    expect(wrapper.findAll('.backlog-card')).toHaveLength(1)
    expect(wrapper.text()).toContain('2 / 3')
    expect(wrapper.get('[data-testid="draw-games"]').classes()).not.toContain('n-button')
    await wrapper.get('[data-testid="draw-games"]').trigger('click')
    await flushPromises()

    expect(cycleServiceMocks.drawCyclePool).toHaveBeenCalledOnce()
    expect(wrapper.findAll('.reveal-card')).toHaveLength(1)

    await wrapper.get('.reveal-card--hidden').trigger('click')

    expect(wrapper.text()).toContain('Random Game')
    expect(wrapper.text()).toContain('Suggested Game')
    expect(wrapper.findAll('.backlog-card')).toHaveLength(2)
    expect(wrapper.text()).toContain('A roda está formada')

    await wrapper.get('[data-testid="start-election"]').trigger('click')
    await flushPromises()

    expect(cycleServiceMocks.startCycleElection).toHaveBeenCalledWith(
      'signed-draw',
      '2026-09-01T00:00:00-03:00',
    )
    expect(messageMocks.success).toHaveBeenCalledWith(
      'A votação está acesa. O grupo já pode votar.',
    )
  })

  it('sets election deadlines at the next Monday and month boundaries', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 5, 12, 0, 0))
    const wrapper = mount(CycleConductor, { global: { plugins: [pinia] } })
    await flushPromises()
    await wrapper.get('[data-testid="draw-games"]').trigger('click')
    await flushPromises()
    await wrapper.get('.reveal-card--hidden').trigger('click')

    const deadlineInput = wrapper.get<HTMLInputElement>('input[type="datetime-local"]')
    expect(deadlineInput.element.value).toBe('2026-09-01T00:00')
    const mondayButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Virada para segunda'))
    const monthButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Virada do mês'))

    expect(mondayButton).toBeDefined()
    expect(monthButton).toBeDefined()
    await mondayButton?.trigger('click')
    expect(deadlineInput.element.value).toBe('2026-08-10T00:00')
    await monthButton?.trigger('click')
    expect(deadlineInput.element.value).toBe('2026-09-01T00:00')
  })

  it('requires a second click before undoing an opened election', async () => {
    cycleServiceMocks.getCycleOverview.mockResolvedValue({
      campaign: {
        id: 17,
        month: 'Agosto',
        year: '2026',
        current: true,
        electionActive: true,
        electionStartedAt: '2026-08-05T20:00:00-03:00',
        meetingAt: '2026-08-27T20:00:00-03:00',
        pool: { options: [{ id: 1, game: { id: 1, title: 'Game' } }] },
      },
      guaranteedGames: [],
      electionResult: [{ optionId: 1, gameId: 1, game: 'Game', tokens: 3, voters: ['Ana'] }],
      targetPoolSize: 5,
      nextCampaign: { month: 'Setembro', year: '2026' },
      discordConfigured: false,
    })
    cycleServiceMocks.cancelCycleElection.mockResolvedValue({
      id: 17,
      month: 'Agosto',
      year: '2026',
      current: true,
      electionActive: false,
      electionStartedAt: null,
      pool: null,
    })
    const wrapper = mount(CycleConductor, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Os resultados estão ocultos')
    expect(wrapper.text()).not.toContain('3 tokens')
    expect(wrapper.find('.result-list').exists()).toBe(false)
    await wrapper.get('[data-testid="reveal-results"]').trigger('click')
    expect(wrapper.text()).toContain('3 tokens')
    expect(wrapper.get<HTMLInputElement>('input[type="datetime-local"]').element.value).toBe(
      '2026-09-24T20:00',
    )
    const hideResults = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Ocultar resultados'))
    await hideResults?.trigger('click')
    expect(wrapper.text()).not.toContain('3 tokens')
    expect(wrapper.find('.result-list').exists()).toBe(false)

    await wrapper.get('.cycle-undo .game-links button').trigger('click')
    expect(cycleServiceMocks.cancelCycleElection).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('os votos já registrados serão descartados')

    await wrapper.get('[data-testid="confirm-cancel-election"]').trigger('click')
    await flushPromises()

    expect(cycleServiceMocks.cancelCycleElection).toHaveBeenCalledOnce()
  })
})

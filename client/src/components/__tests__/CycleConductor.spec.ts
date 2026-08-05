import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('@/services/cycleService', () => cycleServiceMocks)
vi.mock('@/services/gameService', () => ({ getGameCover: vi.fn(() => '') }))
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
    cycleServiceMocks.drawCyclePool.mockResolvedValue({
      campaignId: 17,
      targetPoolSize: 5,
      guaranteedGames: [{ id: 1, title: 'Suggested Game', suggestion: true }],
      selectedFillers: [{ id: 2, title: 'Random Game', suggestion: true }],
      revealOrder: [
        { id: 2, title: 'Random Game', suggestion: true, mainExtraHours: 10 },
        { id: 1, title: 'Suggested Game', suggestion: true, mainExtraHours: 12 },
      ],
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

  it('reveals a signed random selection before opening the election', async () => {
    const wrapper = mount(CycleConductor, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Formar a próxima votação')
    await wrapper.get('.draw-hearth .cycle-primary').trigger('click')
    await flushPromises()

    expect(cycleServiceMocks.drawCyclePool).toHaveBeenCalledOnce()
    expect(wrapper.findAll('.reveal-card')).toHaveLength(1)

    await wrapper.get('.reveal-card--hidden').trigger('click')
    await wrapper.get('.reveal-card--hidden').trigger('click')

    expect(wrapper.text()).toContain('Random Game')
    expect(wrapper.text()).toContain('Suggested Game')
    expect(wrapper.text()).toContain('A roda está formada')

    await wrapper.get('.election-launch .cycle-primary').trigger('click')
    await flushPromises()

    expect(cycleServiceMocks.startCycleElection).toHaveBeenCalledWith('signed-draw', undefined)
    expect(messageMocks.success).toHaveBeenCalledWith(
      'A votação está acesa. O grupo já pode votar.',
    )
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

    await wrapper.get('.cycle-undo .cycle-quiet').trigger('click')
    expect(cycleServiceMocks.cancelCycleElection).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('1 voto será descartado')

    await wrapper.get('.cycle-danger').trigger('click')
    await flushPromises()

    expect(cycleServiceMocks.cancelCycleElection).toHaveBeenCalledOnce()
  })
})

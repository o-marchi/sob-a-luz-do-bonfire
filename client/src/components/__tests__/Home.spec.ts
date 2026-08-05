import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Home from '@/views/Home.vue'
import { useAuthStore } from '@/stores/auth'
import { useCampaignStore } from '@/stores/campaign'

const messageMocks = vi.hoisted(() => ({ error: vi.fn() }))

vi.mock('naive-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('naive-ui')>()),
  useMessage: () => messageMocks,
}))

describe('Home', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    const auth = useAuthStore()
    auth.user = { id: 7, name: 'Ana', isAdmin: false }
    auth.isAuthenticated = true
    auth.loading = false

    const campaign = useCampaignStore()
    campaign.campaign = {
      id: 17,
      month: 'Agosto',
      year: '2026',
      current: true,
      electionActive: true,
      pool: { options: [] },
    }
    vi.spyOn(campaign, 'init').mockResolvedValue()
  })

  it('keeps game recommendations off the page while voting is active', async () => {
    const campaign = useCampaignStore()
    const wrapper = mount(Home, {
      global: {
        plugins: [pinia],
        stubs: {
          ElectionView: { template: '<div data-testid="election" />' },
          CurrentGameHearth: { template: '<div data-testid="current-game" />' },
          GameRecommendation: { template: '<div data-testid="recommendation" />' },
        },
      },
    })

    expect(wrapper.find('[data-testid="recommendation"]').exists()).toBe(false)

    campaign.campaign = { ...campaign.campaign!, electionActive: false }
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="recommendation"]').exists()).toBe(true)
  })
})

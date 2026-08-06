import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TopNavigation from '@/components/TopNavigation.vue'
import { useAuthStore } from '@/stores/auth'
import { useCampaignStore } from '@/stores/campaign'

vi.mock('@/services/userService', () => ({
  getUserTokenBreakdown: vi.fn(() => []),
}))

describe('TopNavigation', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    const auth = useAuthStore()
    auth.user = { id: 1, name: 'Proper Pedestrian', isAdmin: true }
    auth.isAuthenticated = true
    auth.loading = false
    vi.spyOn(useCampaignStore(), 'init').mockResolvedValue()
  })

  const mountNavigation = () =>
    mount(TopNavigation, {
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          NPopover: { template: '<div><slot name="trigger" /><slot /></div>' },
        },
      },
    })

  it('keeps the shortcut hidden until the owner has opened an election', async () => {
    const campaign = useCampaignStore()
    campaign.campaign = {
      id: 17,
      month: 'Agosto',
      year: '2026',
      current: true,
      electionActive: false,
      electionStartedAt: null,
      pool: null,
    }
    const wrapper = mountNavigation()

    expect(wrapper.text()).not.toContain('Conduzir')

    campaign.campaign = {
      ...campaign.campaign,
      electionActive: true,
      electionStartedAt: '2026-08-05T20:00:00-03:00',
      pool: { options: [{ id: 31, game: { id: 1, title: 'Game', suggestion: true } }] },
    }
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Conduzir')
  })

  it('never exposes the shortcut to another user', async () => {
    const auth = useAuthStore()
    const campaign = useCampaignStore()
    auth.user = { id: 2, name: 'Another traveler', isAdmin: false }
    campaign.campaign = {
      id: 17,
      month: 'Agosto',
      year: '2026',
      current: true,
      electionActive: true,
      electionStartedAt: '2026-08-05T20:00:00-03:00',
      pool: { options: [{ id: 31, game: { id: 1, title: 'Game', suggestion: true } }] },
    }
    const wrapper = mountNavigation()

    expect(wrapper.text()).not.toContain('Conduzir')
  })
})

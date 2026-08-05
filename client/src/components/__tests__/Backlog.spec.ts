import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import Backlog from '@/views/Backlog.vue'
import { useAuthStore } from '@/stores/auth'

const gameServiceMocks = vi.hoisted(() => ({
  getGameBacklog: vi.fn(),
  getGameCover: vi.fn(() => ''),
  formatDurationLabel: vi.fn(() => ''),
}))

vi.mock('@/services/gameService', () => gameServiceMocks)

describe('Backlog', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    gameServiceMocks.getGameBacklog.mockResolvedValue({
      retirementThreshold: 3,
      targetPoolSize: 5,
      nextVoteFillCount: 1,
      rubble: [],
      games: [
        {
          id: 1,
          title: 'Fresh Game',
          suggestion: true,
          electionAppearances: 0,
          guaranteedNextVote: true,
          recommendedBy: [{ id: 10, name: 'Ana', avatar: null }],
        },
        {
          id: 2,
          title: 'Returning Game',
          suggestion: true,
          electionAppearances: 1,
          guaranteedNextVote: false,
          recommendedBy: [],
        },
      ],
    })
  })

  it('separates pristine suggestions into the next-vote shelf', async () => {
    const wrapper = mount(Backlog, { global: { plugins: [pinia] } })
    await flushPromises()

    const nextVoteShelf = wrapper.get('.backlog-shelf--next-vote')
    expect(nextVoteShelf.text()).toContain('Na próxima votação')
    expect(nextVoteShelf.text()).toContain('Fresh Game')
    expect(nextVoteShelf.text()).not.toContain('Ainda não passou')
    expect(nextVoteShelf.text()).toContain('+1')
    expect(nextVoteShelf.text()).toContain('jogo das Brasas')
    expect(nextVoteShelf.text()).not.toContain('Returning Game')

    const regularShelf = wrapper
      .findAll('.backlog-shelf')
      .find((shelf) => !shelf.classes().includes('backlog-shelf--next-vote'))
    expect(regularShelf?.text()).toContain('Outros jogos nas Brasas')
    expect(regularShelf?.text()).toContain('Returning Game')
    expect(regularShelf?.text()).not.toContain('Fresh Game')
  })

  it('does not show the next-vote shelf without an active recommendation', async () => {
    gameServiceMocks.getGameBacklog.mockResolvedValue({
      retirementThreshold: 3,
      targetPoolSize: 5,
      nextVoteFillCount: 1,
      rubble: [],
      games: [
        {
          id: 2,
          title: 'Waiting Game',
          suggestion: true,
          electionAppearances: 1,
          guaranteedNextVote: false,
          recommendedBy: [],
        },
      ],
    })

    const wrapper = mount(Backlog, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.find('.backlog-shelf--next-vote').exists()).toBe(false)
    expect(wrapper.text()).toContain('Waiting Game')
  })

  it('shows the conductor entry only to the configured owner', async () => {
    const auth = useAuthStore()
    auth.user = { id: 1, name: 'Proper Pedestrian', isAdmin: true }
    const ownerView = mount(Backlog, {
      global: {
        plugins: [pinia],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(ownerView.get('.backlog-conductor-link').text()).toContain('Conduzir o ciclo')

    auth.user = { id: 2, name: 'Someone else', isAdmin: false }
    await ownerView.vm.$nextTick()
    expect(ownerView.find('.backlog-conductor-link').exists()).toBe(false)
  })
})

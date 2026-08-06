import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import Backlog from '@/views/Backlog.vue'
import { useAuthStore } from '@/stores/auth'
import { useCampaignStore } from '@/stores/campaign'

const gameServiceMocks = vi.hoisted(() => ({
  getGameBacklog: vi.fn(),
  getGameCover: vi.fn(() => ''),
  formatDurationLabel: vi.fn(() => ''),
  retireGameFromRotation: vi.fn(),
}))
const messageMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('@/services/gameService', () => gameServiceMocks)
vi.mock('naive-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('naive-ui')>()),
  useMessage: () => messageMocks,
}))

describe('Backlog', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    gameServiceMocks.retireGameFromRotation.mockResolvedValue(undefined)
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
    expect(wrapper.get('.backlog-overview').text()).toContain('1 jogo à espera da fogueira')
    expect(wrapper.find('.backlog-card__menu').exists()).toBe(false)

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

  it('moves active pool games out of the waiting shelf while voting is open', async () => {
    gameServiceMocks.getGameBacklog.mockResolvedValue({
      retirementThreshold: 3,
      targetPoolSize: 5,
      nextVoteFillCount: 0,
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
        {
          id: 3,
          title: 'Waiting Game',
          suggestion: true,
          electionAppearances: 1,
          guaranteedNextVote: false,
          recommendedBy: [],
        },
      ],
    })
    const campaign = useCampaignStore()
    campaign.electionActive = true
    campaign.election = {
      id: 9,
      options: [
        { id: 11, game: { id: 1, title: 'Fresh Game', suggestion: true } },
        { id: 12, game: { id: 2, title: 'Returning Game', suggestion: true } },
      ],
    }

    const wrapper = mount(Backlog, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.find('.backlog-shelf--next-vote').exists()).toBe(false)
    const currentVoteShelf = wrapper.get('.backlog-shelf--current-vote')
    expect(currentVoteShelf.text()).toContain('Na votação atual')
    expect(currentVoteShelf.text()).toContain('Fresh Game')
    expect(currentVoteShelf.text()).toContain('Returning Game')
    expect(currentVoteShelf.text()).not.toContain('Waiting Game')
    expect(currentVoteShelf.findAll('.backlog-card--current-vote')).toHaveLength(2)
    expect(currentVoteShelf.findAll('.backlog-card__vote-state--current')).toHaveLength(2)
    expect(wrapper.get('.backlog-overview').text()).toContain('1 jogo à espera da fogueira')

    const waitingShelf = wrapper
      .findAll('.backlog-shelf')
      .find(
        (shelf) =>
          !shelf.classes().includes('backlog-shelf--next-vote') &&
          !shelf.classes().includes('backlog-shelf--current-vote'),
      )
    expect(waitingShelf?.text()).toContain('Waiting Game')
    expect(waitingShelf?.text()).not.toContain('Fresh Game')
    expect(waitingShelf?.text()).not.toContain('Returning Game')
  })

  it('lets a historical recommender retire their catalog game without touching the current suggestion', async () => {
    const auth = useAuthStore()
    auth.user = { id: 10, name: 'Ana', isAdmin: false }
    const campaign = useCampaignStore()
    campaign.campaignUser = {
      id: 5,
      player: auth.user,
      played_the_game: false,
      finished_the_game: false,
      suggested_a_game: true,
      suggestedGame: { id: 1, title: 'Fresh Game', suggestion: true },
      partook_in_the_meeting: false,
      tokens: 0,
    }
    gameServiceMocks.getGameBacklog
      .mockResolvedValueOnce({
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
            recommendedBy: [{ id: 10, name: 'Ana', avatar: null }],
          },
        ],
      })
      .mockResolvedValueOnce({
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
        ],
      })

    const wrapper = mount(Backlog, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.get('.backlog-card__menu summary').attributes('aria-label')).toContain(
      'Returning Game',
    )
    expect(wrapper.get('.backlog-card__menu > button').text()).toContain('Retirar da rotação')
    await wrapper.get('.backlog-card__menu > button').trigger('click')
    await flushPromises()

    expect(gameServiceMocks.retireGameFromRotation).toHaveBeenCalledWith(2)
    expect(wrapper.text()).toContain('Fresh Game')
    expect(wrapper.text()).not.toContain('Returning Game')
    expect(messageMocks.success).toHaveBeenCalledWith(
      'Returning Game saiu das próximas rotações. O jogo e seus detalhes continuam guardados.',
    )
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

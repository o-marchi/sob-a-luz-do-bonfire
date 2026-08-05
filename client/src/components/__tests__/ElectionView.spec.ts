import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElectionView from '@/components/ElectionView.vue'
import { useAuthStore } from '@/stores/auth'
import { useCampaignStore } from '@/stores/campaign'

const campaignServiceMocks = vi.hoisted(() => ({
  vote: vi.fn(),
  undoVote: vi.fn(),
}))
const messageMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('@/services/campaignService', () => campaignServiceMocks)
vi.mock('@/services/gameService', () => ({
  getGameCover: vi.fn(() => '/cover.jpg'),
  formatDurationLabel: vi.fn((label?: string | null) => label ?? ''),
}))
vi.mock('naive-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('naive-ui')>()),
  useMessage: () => messageMocks,
}))

describe('ElectionView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    const auth = useAuthStore()
    auth.user = { id: 7, name: 'Ana', isAdmin: false }
    auth.isAuthenticated = true
    auth.loading = false

    const campaign = useCampaignStore()
    campaign.electionActive = true
    campaign.election = {
      id: 9,
      options: [
        {
          id: 31,
          tokens: 12,
          players: [],
          game: {
            id: 1,
            title: 'The First Game',
            suggestion: true,
            summary: 'A primeira jornada da roda.',
            durationLabel: '12 horas',
            steam: 'https://store.steampowered.com/app/1',
            recommendedBy: [
              { id: 17, name: 'Bia', avatar: null },
              { id: 18, name: 'Caio', avatar: null },
            ],
          },
        },
        {
          id: 32,
          tokens: 4,
          players: [],
          game: {
            id: 2,
            title: 'The Second Game',
            suggestion: true,
            summary: 'A segunda jornada da roda.',
          },
        },
      ],
    }
    vi.spyOn(campaign, 'init').mockResolvedValue()
    campaignServiceMocks.vote.mockResolvedValue({ id: 17 })
    campaignServiceMocks.undoVote.mockResolvedValue({ id: 17 })
  })

  it('presents the games without exposing live vote information', async () => {
    const wrapper = mount(ElectionView, { global: { plugins: [pinia] } })

    expect(wrapper.get('.election-hearth').text()).toContain('Qual jogo recebe a próxima chama?')
    expect(wrapper.findAll('.election-card')).toHaveLength(2)
    expect(wrapper.text()).toContain('The First Game')
    expect(wrapper.text()).toContain('12 horas')
    expect(wrapper.text()).toContain('Apresentado por Bia e Caio')
    expect(wrapper.text()).not.toContain('12 tokens')
    expect(wrapper.text()).not.toContain('4 tokens')

    const firstVoteButton = wrapper.findAll('.game-links button')[0]
    await firstVoteButton.trigger('click')
    await flushPromises()

    expect(campaignServiceMocks.vote).toHaveBeenCalledWith(31)
    expect(useCampaignStore().init).toHaveBeenCalledWith({ id: 17 })
  })

  it('shows a private receipt and lets the current voter withdraw', async () => {
    const campaign = useCampaignStore()
    campaign.election!.options[0].players = [{ id: 7, name: 'Ana', isAdmin: false }]
    const wrapper = mount(ElectionView, { global: { plugins: [pinia] } })

    expect(wrapper.text()).toContain('Seu voto está guardado')
    expect(wrapper.text()).toContain('Sua escolha')
    expect(wrapper.text()).toContain('Você já escolheu outra chama.')

    await wrapper.get('.election-card--selected .game-links button').trigger('click')
    await flushPromises()

    expect(campaignServiceMocks.undoVote).toHaveBeenCalledOnce()
    expect(useCampaignStore().init).toHaveBeenCalledWith({ id: 17 })
  })
})

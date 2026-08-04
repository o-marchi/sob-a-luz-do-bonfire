import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GameRecommendation from '../GameRecommendation.vue'
import { useCampaignStore } from '@/stores/campaign'

const gameServiceMocks = vi.hoisted(() => ({
  searchGameRecommendations: vi.fn(),
  assessGameRecommendation: vi.fn(),
  createGameRecommendation: vi.fn(),
  deleteGameRecommendation: vi.fn(),
}))

vi.mock('@/services/gameService', () => gameServiceMocks)

describe('GameRecommendation', () => {
  let pinia: Pinia

  beforeEach(() => {
    vi.useFakeTimers()
    pinia = createPinia()
    setActivePinia(pinia)
    vi.spyOn(useCampaignStore(), 'init').mockResolvedValue()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Object.values(gameServiceMocks).forEach((mock) => mock.mockReset())
  })

  it('searches, verifies, and submits an eligible game', async () => {
    gameServiceMocks.searchGameRecommendations.mockResolvedValue([
      {
        steamAppId: 42,
        title: 'Example Game',
        image: 'https://example.com/capsule.jpg',
        source: 'steam',
      },
    ])
    gameServiceMocks.assessGameRecommendation.mockResolvedValue({
      eligible: true,
      reason: 'eligible',
      limitHours: 20,
      assessmentToken: 'signed-assessment',
      game: {
        steamAppId: 42,
        title: 'Example Game',
        steam: 'https://store.steampowered.com/app/42/',
        cover: 'https://example.com/header.jpg',
        howLongToBeatUrl: 'https://howlongtobeat.com/game/99',
        durationLabel: '12–18 h',
        mainHours: 12,
        mainExtraHours: 18,
        howLongToBeatTitle: 'Example Game',
      },
    })
    gameServiceMocks.createGameRecommendation.mockResolvedValue({
      created: true,
      alreadyRecommended: false,
      electionAppearances: 0,
      game: {
        id: 9,
        title: 'Example Game',
        suggestion: true,
      },
    })
    const wrapper = mount(GameRecommendation, {
      props: { campaignUser: null },
      global: { plugins: [pinia] },
    })

    await wrapper.get('input').setValue('Example')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()

    expect(gameServiceMocks.searchGameRecommendations).toHaveBeenCalledWith(
      'Example',
      expect.any(AbortSignal),
    )
    await wrapper.get('[role="option"]').trigger('click')
    await flushPromises()

    expect(gameServiceMocks.assessGameRecommendation).toHaveBeenCalledWith(42)
    expect(wrapper.text()).toContain('18 h na campanha com extras')

    const submit = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Sugerir este jogo'))
    expect(submit).toBeDefined()
    await submit?.trigger('click')
    await flushPromises()

    expect(gameServiceMocks.createGameRecommendation).toHaveBeenCalledWith('signed-assessment')
    expect(wrapper.text()).toContain('Sua sugestão deste ciclo')
    expect(wrapper.text()).toContain('Já está nas Brasas')
    expect(wrapper.text()).toContain('lugar garantido na próxima votação')
  })

  it('hides search while a suggestion exists and removes it immediately', async () => {
    gameServiceMocks.deleteGameRecommendation.mockResolvedValue(undefined)
    const wrapper = mount(GameRecommendation, {
      props: {
        campaignUser: {
          id: 5,
          player: { id: 10, name: 'Ana' },
          played_the_game: false,
          finished_the_game: false,
          suggested_a_game: true,
          suggestedGame: { id: 9, title: 'Silent Hill f', suggestion: true },
          partook_in_the_meeting: false,
          tokens: 0,
        },
      },
      global: { plugins: [pinia] },
    })

    expect(wrapper.find('input').exists()).toBe(false)
    await wrapper.get('.recommendation-remove').trigger('click')
    await flushPromises()

    expect(gameServiceMocks.deleteGameRecommendation).toHaveBeenCalledOnce()
    expect(useCampaignStore().init).toHaveBeenCalled()
  })
})

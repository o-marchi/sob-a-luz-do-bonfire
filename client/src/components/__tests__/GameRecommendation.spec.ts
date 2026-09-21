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

  const match = { steamAppId: 3357650, title: 'PRAGMATA', source: 'steam' }
  const failedAssessment = { eligible: false, reason: 'lookup_failed', limitHours: 20, game: match }
  const renderAndSelect = async () => {
    gameServiceMocks.searchGameRecommendations.mockResolvedValue([match])
    const wrapper = mount(GameRecommendation, {
      props: { campaignUser: null },
      global: { plugins: [pinia] },
    })
    await wrapper.get('input').setValue('Pragmata')
    await vi.advanceTimersByTimeAsync(350)
    await wrapper.get('[role="option"]').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('explains an outage and retries the same game without allowing a suggestion', async () => {
    gameServiceMocks.assessGameRecommendation
      .mockResolvedValueOnce(failedAssessment)
      .mockResolvedValueOnce({
        ...failedAssessment,
        eligible: true,
        reason: 'eligible',
        assessmentToken: 'verified',
        game: { ...match, mainExtraHours: 16 },
      })
    const wrapper = await renderAndSelect()
    expect(wrapper.text()).toContain('Verificação pendente')
    expect(wrapper.text()).toContain('Não foi possível consultar')
    expect(wrapper.text()).not.toContain('Fora da regra')
    expect(wrapper.text()).not.toContain('Sugerir este jogo')
    await wrapper.get('.recommendation-try-another').trigger('click')
    await flushPromises()
    expect(gameServiceMocks.assessGameRecommendation).toHaveBeenNthCalledWith(2, 3357650)
    expect(wrapper.text()).toContain('Sugerir este jogo')
    expect(gameServiceMocks.createGameRecommendation).not.toHaveBeenCalled()
  })

  it('offers a retry after the assessment request itself fails', async () => {
    gameServiceMocks.assessGameRecommendation
      .mockRejectedValueOnce(new Error('Network failed'))
      .mockResolvedValueOnce(failedAssessment)
    const wrapper = await renderAndSelect()
    expect(wrapper.get('[role="alert"]').text()).toContain('A verificação não terminou')
    await wrapper.get('.recommendation-try-another').trigger('click')
    await flushPromises()
    expect(gameServiceMocks.assessGameRecommendation).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Não foi possível consultar o HowLongToBeat')
  })

  it.each([
    ['duration_unavailable', 'ainda não tem uma estimativa'],
    ['game_not_found', 'Não encontramos este jogo'],
    ['ambiguous_match', 'nomes semelhantes'],
    ['too_long', 'O limite do grupo é 20 h'],
  ])('distinguishes %s and never offers an unverified suggestion', async (reason, message) => {
    gameServiceMocks.assessGameRecommendation.mockResolvedValue({
      ...failedAssessment,
      reason,
      game: { ...match, mainExtraHours: reason === 'too_long' ? 24 : null },
    })
    const wrapper = await renderAndSelect()
    expect(wrapper.text()).toContain(message)
    expect(wrapper.text()).not.toContain('Sugerir este jogo')
    expect(wrapper.text()).not.toContain('Verificar novamente')
  })

  it('ignores an old assessment after the query changes', async () => {
    let resolve!: (value: unknown) => void
    gameServiceMocks.assessGameRecommendation.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = await renderAndSelect()
    await wrapper.get('input').setValue('Another game')
    resolve({ ...failedAssessment, eligible: true, reason: 'eligible', assessmentToken: 'stale' })
    await flushPromises()
    expect(wrapper.find('.recommendation-check').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Sugerir este jogo')
    wrapper.unmount()
  })

  it('ignores a late search result after the input is cleared', async () => {
    let resolve!: (value: unknown) => void
    gameServiceMocks.searchGameRecommendations.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = mount(GameRecommendation, {
      props: { campaignUser: null },
      global: { plugins: [pinia] },
    })
    await wrapper.get('input').setValue('Pragmata')
    await vi.advanceTimersByTimeAsync(350)
    await wrapper.get('input').setValue('')
    resolve([match])
    await flushPromises()
    expect(wrapper.find('[role="option"]').exists()).toBe(false)
    wrapper.unmount()
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

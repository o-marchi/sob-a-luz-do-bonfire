import type { CampaignPlayer } from '@/types/Campaign'

export interface TokenBreakdownItem {
  key: 'base' | 'played' | 'finished' | 'meeting' | 'suggested'
  label: string
  value: number
  applied: boolean
}

export const getUserTokenBreakdown = (user: CampaignPlayer): TokenBreakdownItem[] => [
  {
    key: 'base',
    label: 'Token base do ciclo',
    value: 1,
    applied: true,
  },
  {
    key: 'played',
    label: 'Jogou o jogo do mês',
    value: user.played_the_game ? 1 : 0,
    applied: user.played_the_game,
  },
  {
    key: 'finished',
    label: 'Terminou o jogo',
    value: user.finished_the_game ? 1 : 0,
    applied: user.finished_the_game,
  },
  {
    key: 'meeting',
    label: 'Participou do encontro',
    value: user.partook_in_the_meeting ? 1 : 0,
    applied: user.partook_in_the_meeting,
  },
  {
    key: 'suggested',
    label: 'Sugeriu um jogo',
    value: user.suggested_a_game ? -1 : 0,
    applied: user.suggested_a_game,
  },
]

export const calculateUserTokens = (user: CampaignPlayer): number => {
  return getUserTokenBreakdown(user).reduce((total, item) => total + item.value, 0)
}

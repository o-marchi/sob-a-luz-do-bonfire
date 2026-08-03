import type { CampaignPlayer } from '@/types/Campaign'

export interface TokenBreakdownItem {
  key: 'base' | 'played' | 'finished' | 'meeting' | 'suggested'
  label: string
  value: number
  applied: boolean
}

export type JourneyStatus = 'not-started' | 'playing' | 'finished'

export const getJourneyStatus = (user: CampaignPlayer): JourneyStatus => {
  if (user.finished_the_game) {
    return 'finished'
  }

  return user.played_the_game ? 'playing' : 'not-started'
}

export const getJourneyFlags = (status: JourneyStatus) => ({
  played_the_game: status !== 'not-started',
  finished_the_game: status === 'finished',
})

export const formatJourneyCount = (count: number): string => {
  return `${count} ${count === 1 ? 'pessoa' : 'pessoas'} na jornada`
}

export const formatJourneyCompanionCount = (count: number): string => {
  if (count === 0) {
    return 'Ninguém te acompanha ainda'
  }

  return `${count} ${count === 1 ? 'pessoa te acompanha' : 'pessoas te acompanham'}`
}

export const getPlayerName = (campaignPlayer: CampaignPlayer): string => {
  return (
    campaignPlayer.player.name?.trim() ||
    campaignPlayer.player.discord?.globalName?.trim() ||
    campaignPlayer.player.discord?.username?.trim() ||
    'Participante'
  )
}

export const getJourneyPlayers = (players: CampaignPlayer[]): CampaignPlayer[] => {
  return players
    .filter((player) => getJourneyStatus(player) !== 'not-started')
    .sort((left, right) => left.player.id - right.player.id)
}

export const calculateJourneyRosterSpacing = (
  containerWidth: number,
  playerCount: number,
  playerWidth = 32,
  preferredSpacing = 28,
): number => {
  if (containerWidth <= 0 || playerCount <= 1) {
    return 0
  }

  const availableSpacing = (containerWidth - playerCount * playerWidth) / (playerCount - 1)
  return Math.min(preferredSpacing, availableSpacing)
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

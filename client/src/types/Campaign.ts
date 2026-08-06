import type { Game } from '@/types/Game.ts'
import type { User } from '@/types/User.ts'

export interface PoolOption {
  id: number
  game: Game
  tokens?: number
  players?: User[]
}

export interface Pool {
  id?: number
  options: PoolOption[]
}

export interface CampaignPlayer {
  id: number
  player: User
  played_the_game: boolean
  finished_the_game: boolean
  suggested_a_game: boolean
  suggestedGame?: Game | null
  partook_in_the_meeting: boolean
  tokens: number
}

export interface Campaign {
  id: number
  month: string
  year: string
  current: boolean
  description?: string | null
  meetingAt?: string | null
  meetingLocation?: string | null
  meetingUrl?: string | null
  electionActive: boolean
  electionStartedAt?: string | null
  electionEndsAt?: string | null
  electionClosedAt?: string | null
  pool?: Pool | null
  game?: Game | null
  players?: CampaignPlayer[]
}

export interface PlayerGameInformation {
  played_the_game: boolean
  finished_the_game: boolean
}

import type { Game } from '@/types/Game.ts'
import type { User } from '@/types/User.ts'

export interface PoolOption {
  id?: string
  game?: Game
  tokens?: number
  players?: User[]
}

export interface Pool {
  options: PoolOption[]
}

export interface CampaignPlayer extends User {
  player: number
  played_the_game: boolean
  finished_the_game: boolean
  suggested_a_game: string
  partook_in_the_meeting: boolean
  tokens: number
}

export interface Campaign {
  id: number
  month?: string
  year?: string
  current: boolean
  description?: string
  electionActive?: boolean
  pool?: Pool
  game?: Game
  players?: CampaignPlayer[]
}

export interface PlayerGameInformation {
  played_the_game: boolean
  finished_the_game: boolean
}

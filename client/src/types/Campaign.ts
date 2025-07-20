import type { Game, GameData } from '@/types/Game.ts'
import type { User } from '@/types/User.ts'

export interface CampaignUserData {
  id: number
  played_the_game: boolean
  finished_the_game: boolean
  suggested_a_game: boolean
  partook_in_the_meeting: boolean
  users_permissions_user: User
}

export interface CampaignData {
  id: number
  month?: string
  year?: string
  current: boolean
  game?: GameData
  user?: CampaignUserData[]
  createdAt: string
  updatedAt: string
  publishedAt: string
}

export interface CampaignUser extends User {
  tokens: number
  played_the_game: boolean
  finished_the_game: boolean
  suggested_a_game: boolean
  partook_in_the_meeting: boolean
}

export interface Campaign {
  id: number
  month?: string
  year?: string
  current: boolean
  game: Game | null
  users?: CampaignUser[]
  createdAt: string
  updatedAt: string
  publishedAt: string
}


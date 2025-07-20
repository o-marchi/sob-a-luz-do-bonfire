import type { Game, GameData } from '@/types/Game.ts'

export interface GlobalDataResponse {
  id: number
  game?: GameData
  createdAt: string
  updatedAt: string
  publishedAt: string
}

export interface GlobalData {
  id: number
  game?: Game
  createdAt: string
  updatedAt: string
  publishedAt: string
}


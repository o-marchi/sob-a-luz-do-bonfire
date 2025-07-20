export interface GameData {
  id: number
  title: string
  order: number
  month?: string
  year?: string
  heroDescription?: any[]
  cover?: {
    name: string
    width: number
    height: number
    mime: string
    ext: string
    size: number
    url: string
    hash: string
  }
  createdAt: string
  updatedAt: string
  publishedAt: string
}

export interface Game {
  id: number
  title: string
  order: number
  month?: string
  year?: string
  heroDescription?: any[],
  image?: string,
}

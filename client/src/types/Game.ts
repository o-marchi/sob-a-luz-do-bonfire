export interface Game {
  id: number
  title?: string
  suggestion?: boolean
  cover?: {
    alt?: string
    filename?: number
    mimeType?: number
    url: string
  }
  createdAt: string
  updatedAt: string
  publishedAt: string
}

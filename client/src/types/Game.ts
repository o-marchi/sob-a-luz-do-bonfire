export interface Game {
  id: number
  title: string
  suggestion: boolean
  steam?: string | null
  trailer?: string | null
  cover?: string | null
  summary?: string | null
  howLongToBeatUrl?: string | null
  durationLabel?: string | null
}

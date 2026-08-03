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
  recommendedBy?: GameRecommender[]
}

export interface GameRecommender {
  id: number
  name: string
  avatar?: string | null
}

export interface BacklogGame extends Game {
  electionAppearances: number
  recommendedBy: GameRecommender[]
}

export interface GameBacklog {
  games: BacklogGame[]
  rubble: BacklogGame[]
  retirementThreshold: number
}

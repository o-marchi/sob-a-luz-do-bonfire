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
  mainHours?: number | null
  mainExtraHours?: number | null
  howLongToBeatTitle?: string | null
  researchCheckedAt?: string | null
  researchStatus?: string | null
  recommendedBy?: GameRecommender[]
}

export interface GameRecommender {
  id: number
  name: string
  avatar?: string | null
}

export interface BacklogGame extends Game {
  electionAppearances: number
  guaranteedNextVote: boolean
  recommendedBy: GameRecommender[]
}

export interface GameBacklog {
  games: BacklogGame[]
  rubble: BacklogGame[]
  retirementThreshold: number
  targetPoolSize: number
  nextVoteFillCount: number
}

export interface SteamGameSearchResult {
  steamAppId: number
  title: string
  image?: string | null
  source: 'catalog' | 'steam'
}

export type GameAssessmentReason =
  | 'eligible'
  | 'too_long'
  | 'duration_unavailable'
  | 'not_a_game'
  | 'already_played'
  | 'already_suggested'

export interface ResearchedGame {
  steamAppId: number
  title: string
  cover?: string | null
  steam: string
  trailer?: string | null
  summary?: string | null
  howLongToBeatUrl?: string | null
  durationLabel?: string | null
  mainHours?: number | null
  mainExtraHours?: number | null
  howLongToBeatTitle?: string | null
}

export interface GameRecommendationAssessment {
  eligible: boolean
  reason: GameAssessmentReason
  limitHours: number
  game: ResearchedGame
  assessmentToken?: string
  existingSuggestion?: Pick<Game, 'id' | 'title'>
}

export interface CreatedGameRecommendation {
  game: Game
  created: boolean
  alreadyRecommended: boolean
  electionAppearances: number
}

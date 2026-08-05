import type { Campaign } from './Campaign'
import type { Game } from './Game'

export interface ElectionResultOption {
  optionId: number
  gameId: number
  game: string
  tokens: number
  voters: string[]
}

export interface CycleOverview {
  campaign: Campaign
  guaranteedGames: Game[]
  electionResult: ElectionResultOption[]
  targetPoolSize: number
  nextCampaign: { month: string; year: string }
  discordConfigured: boolean
}

export interface CycleDraw {
  campaignId: number
  targetPoolSize: number
  guaranteedGames: Game[]
  selectedFillers: Game[]
  revealOrder: Game[]
  excludedUnverified: Game[]
  excludedTooLong: Game[]
  selectionToken: string
  warnings: string[]
}

export interface DiscordChannelSummary {
  id: string
  name: string
  type: number
  parent_id: string | null
  topic?: string | null
}

export interface DiscordTransitionInput {
  enabled: boolean
  oldChannelId?: string
  discussionCategoryId?: string
  historyCategoryId?: string
  voiceChannelId?: string
  newChannelName?: string
  newChannelTopic?: string
}

export interface CycleTransitionInput {
  winnerGameId?: number
  month: string
  year: string
  description?: string
  meetingAt?: string
  meetingLocation?: string
  discord?: DiscordTransitionInput
  allowEarlyClose?: boolean
}

export interface DiscordTransitionPreview {
  configured: boolean
  enabled: boolean
  guildId: string
  channels: {
    text: DiscordChannelSummary[]
    categories: DiscordChannelSummary[]
    voice: DiscordChannelSummary[]
  }
  plan: {
    oldChannel: DiscordChannelSummary | null
    discussionCategory: DiscordChannelSummary | null
    historyCategory: DiscordChannelSummary | null
    createHistoryCategory: boolean
    newChannelName: string
    newChannelTopic: string
    existingNewChannel: DiscordChannelSummary | null
    voiceChannel: DiscordChannelSummary | null
    eventName: string | null
    gameCard: {
      title: string
      description: string
      url: string | null
      imageUrl: string | null
      details: string | null
      marker: string
    }
  }
  warnings: string[]
  errors: string[]
}

export interface CycleTransitionPreview {
  valid: boolean
  errors: string[]
  warnings: string[]
  confirmationToken: string | null
  electionResult: ElectionResultOption[]
  winner: Game | null
  campaign: {
    month: string
    year: string
    description: string
    meetingAt: string | null
    meetingLocation: string | null
  } | null
  discord: DiscordTransitionPreview | null
}

export interface AppliedCycleTransition {
  campaign: Campaign
  discord: {
    archivedChannelId: string | null
    historyCategoryId: string | null
    newChannelId: string | null
    eventId: string | null
    eventUrl: string | null
    gameMessageId: string | null
    gameMessageUrl: string | null
  }
}

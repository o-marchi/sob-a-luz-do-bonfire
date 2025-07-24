import type { CampaignPlayer } from '@/types/Campaign.ts'

export const calculateUserTokens = (user: CampaignPlayer): number => {
  let tokens = 1;

  if (user.played_the_game) {
    tokens += 1;
  }

  if (user.finished_the_game) {
    tokens += 1;
  }

  if (user.partook_in_the_meeting) {
    tokens += 1;
  }

  if (user.suggested_a_game) {
    tokens -= 1;
  }

  return tokens;
}
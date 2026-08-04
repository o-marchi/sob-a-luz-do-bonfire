import { z } from "zod";

export const gameInputSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  cover: z.string().optional(),
  suggestion: z.boolean().optional(),
  steam: z.string().optional(),
  trailer: z.string().optional(),
  summary: z.string().optional(),
  howLongToBeatUrl: z.string().optional(),
  durationLabel: z.string().optional(),
  mainHours: z.number().nonnegative().optional(),
  mainExtraHours: z.number().nonnegative().optional(),
  howLongToBeatTitle: z.string().optional(),
});

export const campaignInputSchema = z.object({
  id: z.number().int().positive().optional(),
  useCurrent: z.boolean().optional(),
  month: z.string().min(1).optional(),
  year: z.string().min(1).optional(),
  description: z.string().optional(),
  meetingAt: z.string().datetime({ offset: true }).optional(),
  meetingLocation: z.string().optional(),
  meetingUrl: z.string().optional(),
  electionActive: z.boolean().optional(),
  gameId: z.number().int().positive().optional(),
  gameTitle: z.string().min(1).optional(),
  poolId: z.number().int().positive().optional(),
  current: z.boolean().optional(),
  setCurrent: z.boolean().optional(),
});

export const poolInputSchema = z.object({
  gameIds: z.array(z.number().int().positive()).optional(),
  gameTitles: z.array(z.string().min(1)).optional(),
  attachToCampaign: z.boolean().optional(),
});

export const playerReferenceSchema = z.object({
  playerId: z.number().int().positive().optional(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  discordId: z.string().min(1).optional(),
  discordUsername: z.string().min(1).optional(),
  createIfMissing: z.boolean().optional(),
});

export const participantInputSchema = z.object({
  player: playerReferenceSchema,
  played_the_game: z.boolean().optional(),
  finished_the_game: z.boolean().optional(),
  partook_in_the_meeting: z.boolean().optional(),
  suggested_a_game: z.boolean().optional(),
  suggestedGameId: z.number().int().positive().optional(),
  suggestedGameTitle: z.string().min(1).optional(),
});

export const gameRecommendationInputSchema = z.object({
  player: playerReferenceSchema,
  gameId: z.number().int().positive().optional(),
  gameTitle: z.string().min(1).optional(),
});

export const monthlyPlanSchema = z.object({
  campaign: campaignInputSchema.optional(),
  games: z.array(gameInputSchema).optional(),
  pool: poolInputSchema.optional(),
  participants: z.array(participantInputSchema).optional(),
  recommendations: z.array(gameRecommendationInputSchema).optional(),
});

export const applyMonthlyPlanSchema = monthlyPlanSchema.extend({
  confirm: z.literal(true),
  confirmationToken: z.string().min(1),
});

export const upsertGamesSchema = z.object({
  games: z.array(gameInputSchema).min(1),
});

export const createPoolFromGamesSchema = poolInputSchema.extend({
  campaignId: z.number().int().positive().optional(),
});

export const attachPoolToCampaignSchema = z.object({
  poolId: z.number().int().positive(),
  campaignId: z.number().int().positive().optional(),
});

export const updateCampaignSchema = campaignInputSchema.extend({
  campaignId: z.union([z.number().int().positive(), z.literal("current")]),
});

export const bulkParticipantsSchema = z.object({
  campaignId: z.union([z.number().int().positive(), z.literal("current")]),
  participants: z.array(participantInputSchema).min(1),
});

export const campaignIdSchema = z.object({
  campaignId: z.union([z.number().int().positive(), z.literal("current")]),
});

export const finalizeElectionSchema = campaignIdSchema.extend({
  allowTie: z.boolean().optional(),
});

export const querySchema = z.object({
  query: z.string().optional(),
});

export const updateRulesSchema = z.object({
  content: z
    .string()
    .max(100_000)
    .refine((value) => value.trim().length > 0, {
      message: "Rules must contain visible text",
    }),
});

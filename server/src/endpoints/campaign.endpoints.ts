import { Endpoint, PayloadRequest } from 'payload'
import { DiscordAuthService } from '@/services/discord-auth.service'
import { CampaignService, type PlayerGameInformation } from '@/services/campaign.service'
import { Campaign, Player } from '@/payload-types'

const basePath: string = '/campaign'

export const getCurrentCampaign: Endpoint = {
  path: `${basePath}/current`,
  method: 'get',
  handler: await DiscordAuthService.playerAuthMiddleware(
    async (req: PayloadRequest): Promise<Response> => {
      try {
        const { includePlayerInCampaign } = req.query
        const currentUserEmail: string = req.user?.email as string

        let campaign: Campaign | null

        if (!includePlayerInCampaign || !currentUserEmail) {
          campaign = await CampaignService.getCurrentCampaign(req)
        } else {
          const player: Player | null = await DiscordAuthService.findPlayerByEmail(
            req,
            currentUserEmail,
          )

          if (!player) {
            throw new Error('No player found')
          }

          campaign = await CampaignService.addPlayerToCurrentCampaign(req, player)
        }

        if (!campaign) {
          throw new Error('No current campaign found')
        }

        return new Response(JSON.stringify({ campaign }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }
    },
  ),
}

export const updatePlayerGameInformation: Endpoint = {
  path: `${basePath}/update-player-game-information`,
  method: 'put',
  handler: await DiscordAuthService.playerAuthMiddleware(
    async (req: PayloadRequest): Promise<Response> => {
      try {
        // @ts-ignore
        const playerGameInformation: PlayerGameInformation = await req.json()

        if (!playerGameInformation) {
          throw new Error('No player game information provided')
        }

        const campaign = await CampaignService.updatePlayerGameInformation(
          req,
          playerGameInformation,
        )

        return new Response(JSON.stringify(campaign), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }
    },
    { forceAuth: true },
  ),
}

export const undoVote: Endpoint = {
  path: `${basePath}/undo-vote`,
  method: 'post',
  handler: await DiscordAuthService.playerAuthMiddleware(
    async (req: PayloadRequest): Promise<Response> => {
      try {
        const campaign = await CampaignService.undoVote(req)

        return new Response(JSON.stringify({ campaign }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }
    },
    { forceAuth: true },
  ),
}

export const vote: Endpoint = {
  path: `${basePath}/vote`,
  method: 'post',
  handler: await DiscordAuthService.playerAuthMiddleware(
    async (req: PayloadRequest): Promise<Response> => {
      try {
        // @ts-ignore
        const { option }: { option: string } = await req.json()

        if (!option) {
          throw new Error('No option provided')
        }

        await CampaignService.undoVote(req)
        const campaign = await CampaignService.vote(req, option)

        return new Response(JSON.stringify({ campaign }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }
    },
    { forceAuth: true },
  ),
}

export const recalculateElectionResult: Endpoint = {
  path: `${basePath}/recalculate-election-result`,
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    try {
      const campaign: Campaign = await CampaignService.recalculateElectionResults(req)

      const highestTokens = Math.max(
        ...(campaign?.election?.electionOptions?.map((option) => option.tokens || 0) || []),
      )

      const winner = campaign?.election?.electionOptions?.filter(
        (option) => option.tokens === highestTokens,
      )

      return new Response(JSON.stringify({ winner }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
  },
}

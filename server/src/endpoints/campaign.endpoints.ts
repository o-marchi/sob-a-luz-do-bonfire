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

        const updatedPlayer = await CampaignService.updatePlayerGameInformation(
          req,
          playerGameInformation,
        )

        return new Response(JSON.stringify(updatedPlayer), {
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

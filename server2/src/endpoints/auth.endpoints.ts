import { Endpoint, jwtSign, PayloadRequest } from 'payload'
import { Player } from '@/payload-types'
import { DiscordAuthService } from '@/services/discord-auth.service'
import { CampaignService } from '@/services/campaign.service'

export const discordAuthEndpoint: Endpoint = {
  path: '/connect/discord',
  method: 'get',
  handler: async (): Promise<Response> => {

    const url = DiscordAuthService.generateAuthUrl()

    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
      }
    })
  }
}

export const discordCallbackEndpoint: Endpoint = {
  path: '/connect/discord/callback',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    try {
      const { code } = req.query
      const clientAuthCallbackUrl = process.env.PAYLOAD_PUBLIC_SITE_URL + '/auth/callback'

      if (!code || typeof code !== 'string') {
        throw new Error('No code provided')
      }

      const { player, token: access_token }: { player: Player, token: string } =
        await DiscordAuthService.authenticateWithCode(req, code)

      const { token: jwt }: { token: string } = await jwtSign({
        fieldsToSign: {
          ...player,
          accessToken: access_token,
        },
        secret: process.env.JWT_SECRET as string,
        tokenExpiration: 604800,
      })

      try {
        await CampaignService.addPlayerToCurrentCampaign(req, player)
      } catch (error: any) {
        console.error('discordCallbackEndpoint: failed to add user to campaign', error)
      }

      return new Response(null, {
        status: 302,
        headers: {
          Location: clientAuthCallbackUrl + '?jwt=' + jwt + '&access_token=' + access_token,
        },
      })
    } catch (error) {
      console.error('discordCallbackEndpoint: ', error)

      return new Response(null, {
        status: 302,
        headers: {
          Location: process.env.PAYLOAD_PUBLIC_SITE_URL + '?authentication_error=true' || '',
        },
      })
    }
  }
}

export const testEndpoint: Endpoint = {
  path: '/test',
  method: 'get',
  handler: await DiscordAuthService.playerAuthMiddleware(
    async (req: PayloadRequest): Promise<Response> => {
      try {
        // const { accessToken } = req.query
        //
        // const { player, token }: { player: Player | null, token: string } =
        //   await DiscordAuthService.authenticateWithAccessToken(req, accessToken as string)
        //
        // return new Response(JSON.stringify({ player, token }), {
        //   status: 200,
        //   headers: {
        //     'Content-Type': 'application/json'
        //   }
        // })

        return new Response(JSON.stringify({ oi: 'oi', user: req.user }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      } catch (error: any) {

        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      }
    }
  )
}

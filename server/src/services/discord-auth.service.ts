import { jwtSign, PayloadRequest } from 'payload'
import DiscordOAuth2 from 'discord-oauth2'
import { Player } from '@/payload-types'
import { PayloadHandler } from 'payload/dist/config/types'
import { jwtVerify } from 'jose'

export class DiscordAuthService {
  static getDiscordOAuth2(): DiscordOAuth2 {
    return new DiscordOAuth2({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      redirectUri: `${process.env.PAYLOAD_PUBLIC_SERVER_URL}/api/connect/discord/callback`,
    })
  }

  static generateAuthUrl(): string {
    const oauth = this.getDiscordOAuth2()

    return oauth.generateAuthUrl({
      scope: ['identify', 'email'],
    })
  }

  static async findPlayerByDiscordId(
    req: PayloadRequest,
    discordUserId: string,
  ): Promise<Player | null> {
    const playerDocs = await req.payload.find({
      collection: 'players',
      where: {
        'discord.discordId': discordUserId,
      },
    })

    if (playerDocs.docs.length) {
      return playerDocs.docs[0]
    }

    return null
  }

  static async findPlayerByEmail(
    req: PayloadRequest,
    email: string,
  ): Promise<Player | null> {
    const playerDocs = await req.payload.find({
      collection: 'players',
      where: {
        email,
      },
    })

    if (playerDocs.docs.length) {
      return playerDocs.docs[0]
    }

    return null
  }

  static async findOrCreatePlayerByDiscordUser(
    req: PayloadRequest,
    discordUser: DiscordOAuth2.User,
  ): Promise<Player> {
    const player = await this.findPlayerByDiscordId(req, discordUser.id)

    if (player) {
      return player
    }

    return await req.payload.create({
      collection: 'players',
      data: {
        email: discordUser.email as string,
        name: discordUser.global_name || discordUser.username,
        discord: {
          discordId: discordUser.id,
          username: discordUser.username,
          global_name: discordUser.global_name,
          avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
        },
      },
    })
  }

  static async authenticateWithCode(
    req: PayloadRequest,
    code: string,
  ): Promise<{ player: Player; token: string }> {
    const oauth = this.getDiscordOAuth2()

    const tokenData = await oauth.tokenRequest({
      code,
      scope: 'identify email',
      grantType: 'authorization_code',
    })

    const accessToken: string = tokenData.access_token
    const discordUser: DiscordOAuth2.User = await oauth.getUser(accessToken)

    return {
      player: await this.findOrCreatePlayerByDiscordUser(req, discordUser),
      token: accessToken,
    }
  }

  static async authenticateWithAccessToken(
    req: PayloadRequest,
    accessToken: string,
  ): Promise<{ player: Player | null; token: string }> {
    const oauth = this.getDiscordOAuth2()

    const discordUser: DiscordOAuth2.User = await oauth.getUser(accessToken)
    const player: Player | null = (await this.findPlayerByDiscordId(req, discordUser.id)) || null

    const { token }: { token: string } = await jwtSign({
      fieldsToSign: {
        ...player,
        accessToken,
      },
      secret: process.env.JWT_SECRET as string,
      tokenExpiration: 604800,
    })

    return {
      player,
      token,
    }
  }

  static async playerAuthMiddleware(
    handler: PayloadHandler,
    options: { forceAuth: boolean } = { forceAuth: false },
  ): Promise<PayloadHandler> {

    return async (req: PayloadRequest): Promise<Response> => {
      
      try {
        if (req.user) {
          return handler(req)
        }

        const authHeader: string | null = req.headers.get('authorization')
        const jwtToken: string | null = authHeader?.replace('Bearer ', '') || null

        const secretKey = new TextEncoder().encode(process.env.JWT_SECRET)
        const { payload: user } = await jwtVerify(jwtToken, secretKey);

        if (!user) {
          throw new Error('Invalid JWT token')
        }

        req.user = user

        const discordId: string = user.discord.discordId as string
        const player: Player | null = await DiscordAuthService.findPlayerByDiscordId(req, discordId)

        if (!player) {
          throw new Error('Player not found')
        }

        return handler(req, player);
      } catch (error: any) {
        console.error('playerAuthMiddleware: ', error);

        if (options.forceAuth) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        }

        return handler(req);
      }
    }

  }
}
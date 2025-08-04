import { Campaign, Player } from '@/payload-types'
import { PayloadRequest } from 'payload'

export interface PlayerGameInformation {
  played_the_game: boolean
  finished_the_game: boolean
}

export class CampaignService {
  static async getCurrentCampaign(req: PayloadRequest): Promise<Campaign> {
    const campaignDocs = await req.payload.find({
      collection: 'campaigns',
      where: {
        current: {
          equals: true,
        },
      },
      limit: 1,
    })

    if (!campaignDocs?.docs?.length) {
      throw new Error('No current campaign found')
    }

    return campaignDocs.docs[0]
  }

  static findPlayerInCampaign(campaign: Campaign, playerId: number): any {
    return (campaign.players || []).find((p: any) => p?.player?.id === playerId)
  }

  static async addPlayerToCurrentCampaign(req: PayloadRequest, player: Player): Promise<Campaign> {
    const campaign: Campaign = await this.getCurrentCampaign(req)

    const isPlayerInCampaign: boolean = !!CampaignService.findPlayerInCampaign(campaign, player.id)

    if (isPlayerInCampaign) {
      return campaign
    }

    const newCampaignPlayer = {
      player: player.id,
      played_the_game: false,
      finished_the_game: false,
      partook_in_the_meeting: false,
      suggested_a_game: '',
    }

    const updatedCampaignPlayers = [...(campaign.players || []), newCampaignPlayer]

    // @ts-ignore
    return await req.payload.update<Campaign>({
      collection: 'campaigns',
      id: campaign.id,
      data: {
        players: updatedCampaignPlayers,
      },
    })
  }

  static async updatePlayerGameInformation(
    req: PayloadRequest,
    playerGameInformation: PlayerGameInformation,
  ): Promise<any> {
    const loggedUserId = req?.user?.id

    if (!loggedUserId) {
      throw new Error('User ID is required')
    }

    const campaign: Campaign = await this.getCurrentCampaign(req)
    const player = CampaignService.findPlayerInCampaign(campaign, loggedUserId)

    if (!player) {
      throw new Error('Player not found in current campaign')
    }

    let updatedPlayer

    const updatedPlayers = campaign.players?.map((p: any) => {
      if (p.player.id === loggedUserId) {
        updatedPlayer = {
          ...p,
          ...playerGameInformation,
        }

        return updatedPlayer
      }
      return p
    })

    return await req.payload.update({
      collection: 'campaigns',
      id: campaign.id,
      data: {
        players: updatedPlayers,
      },
    })
  }

  static async vote(req: PayloadRequest, selectedOption: string): Promise<any> {
    const loggedUserId = req?.user?.id

    if (!loggedUserId) {
      throw new Error('User ID is required')
    }

    const campaign: Campaign = await this.getCurrentCampaign(req)
    const player = CampaignService.findPlayerInCampaign(campaign, loggedUserId)

    if (!player) {
      throw new Error('Player not found in current campaign')
    }

    if (!campaign?.election?.active) {
      throw new Error('Election is not active')
    }

    const electionOptions = campaign?.election?.electionOptions || []

    electionOptions.forEach((option: any) => {
      if (option.id !== selectedOption) {
        return
      }

      if (option.voters.find((voter: any) => voter?.player?.id === loggedUserId)) {
        return
      }

      option.voters = [...(option.voters || []), { player: { id: loggedUserId } }]
    })

    return await req.payload.update({
      collection: 'campaigns',
      id: campaign.id,
      data: {
        election: {
          ...campaign.election,
          electionOptions,
        },
      },
    })
  }

  static async undoVote(req: PayloadRequest): Promise<any> {
    const loggedUserId = req?.user?.id

    if (!loggedUserId) {
      throw new Error('User ID is required')
    }

    const campaign: Campaign = await this.getCurrentCampaign(req)
    const player = CampaignService.findPlayerInCampaign(campaign, loggedUserId)

    if (!player) {
      throw new Error('Player not found in current campaign')
    }

    if (!campaign?.election?.active) {
      throw new Error('Election is not active')
    }

    const electionOptions = campaign?.election?.electionOptions || []

    electionOptions.forEach((option: any) => {
      option.voters = option.voters.filter((voter: any) => voter?.player?.id !== loggedUserId)
    })

    return await req.payload.update({
      collection: 'campaigns',
      id: campaign.id,
      data: {
        election: {
          ...campaign.election,
          electionOptions,
        },
      },
    })
  }

  static async recalculateElectionResults(req: PayloadRequest): Promise<Campaign> {
    const campaign: Campaign = await this.getCurrentCampaign(req)
    const electionOptions = campaign?.election?.electionOptions || []

    return await req.payload.update({
      collection: 'campaigns',
      id: campaign.id,
      data: {
        election: {
          ...campaign.election,
          electionOptions,
        },
      },
    })
  }
}

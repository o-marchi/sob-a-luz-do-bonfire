import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { Campaign } from './entities/campaign.entity';
import { Player } from '../players/entities/player.entity';

describe('CampaignController', () => {
  const createCampaign = (): Campaign =>
    ({
      id: 17,
      month: 'Agosto',
      year: '2026',
      current: true,
      meetingUrl: 'https://discord.com/channels/server-id/channel-id',
    }) as Campaign;

  it('hides the private meeting URL from public visitors', async () => {
    const campaign = createCampaign();
    const campaignService = {
      current: jest.fn().mockResolvedValue(campaign),
    };
    const controller = new CampaignController(
      campaignService as unknown as CampaignService,
    );

    await expect(controller.current(null)).resolves.toMatchObject({
      meetingUrl: null,
    });
  });

  it('returns the meeting URL to an authenticated player', async () => {
    const campaign = createCampaign();
    const campaignService = {
      current: jest.fn().mockResolvedValue(campaign),
    };
    const controller = new CampaignController(
      campaignService as unknown as CampaignService,
    );

    await expect(
      controller.current({ id: 1 } as Player),
    ).resolves.toMatchObject({
      meetingUrl: 'https://discord.com/channels/server-id/channel-id',
    });
  });
});

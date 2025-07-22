'use strict';

/**
 * campaign controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

const getCurrentCampaign = async (strapi, ctx) => {
  const campaigns = await strapi.query('api::campaign.campaign').findMany({
    // filters: {
    //     publishedAt: { $notNull: true },
    //     // current: true,
    // },
    populate: {
      game: {
        populate: ['cover'],
      },
      user: {
        populate: ['users_permissions_user'],
      },
    },
    limit: 1,
  });

  const campaign = campaigns.filter(campaign => {
    return campaign.current;
  })?.[0];

  return campaign;
};

module.exports = createCoreController('api::campaign.campaign', ({ strapi }) => ({

  async getCurrentCampaignInternal(ctx) {
    return await getCurrentCampaign(strapi, ctx);
  },

  async getCurrentCampaign(ctx) {
    const currentCampaign = await getCurrentCampaign(strapi, ctx);
    ctx.body = currentCampaign;

    return currentCampaign;
  },

  async updatePlayerGameInformation(ctx) {
    const campaign = await getCurrentCampaign(strapi, ctx);
    const currentUser = ctx.state.user;
    const body = ctx.request.body;

    if (!currentUser) {
      ctx.body = campaign;
      return;
    }

    async function updateCampagin () {
      const updatedUser = campaign.user.map(campaignUser => {
        if (campaignUser?.users_permissions_user?.id === currentUser.id) {
          return {
            __component: 'campaign.user',
            users_permissions_user: currentUser.id,
            played_the_game: body.played_the_game,
            finished_the_game: body.finished_the_game,
            suggested_a_game: currentUser.suggested_a_game,
            partook_in_the_meeting: currentUser.partook_in_the_meeting,
          }
        }

        return campaignUser;
      });

      const updatedCampaign = await strapi.entityService.update('api::campaign.campaign', campaign.id, {
        data: {
          user: updatedUser,
        }
      });

      return updatedCampaign;
    }

    try {
      let attempts = 0;
      let success = false;

      while (!success && attempts < 5) {
        try {
          const updatedCampaign = await updateCampagin();
          success = true;
          ctx.body = updatedCampaign;

          return;
        } catch (err) {
          attempts++;
          if (attempts === 5) throw err;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

    } catch (error) {
      const updatedCampaign = await strapi.entityService.update('api::campaign.campaign', campaign.id, {
        data: {
          month: campaign.month
        }
      });

      ctx.body = updatedCampaign;
    }

  },

}));

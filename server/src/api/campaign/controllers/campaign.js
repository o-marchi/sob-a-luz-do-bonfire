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

    const updatedUser = campaign.user.map(campaignUser => {
      if (campaignUser?.users_permissions_user?.id === currentUser.id) {
        return {
          __component: 'campaign.user',
          users_permissions_user: currentUser.id,
          suggested_a_game: currentUser.suggested_a_game,
          partook_in_the_meeting: currentUser.partook_in_the_meeting,

          played_the_game: body.played_the_game,
          finished_the_game: body.finished_the_game,
        }
      }

      return campaignUser;
    });

    const updatedCampaign = await strapi.entityService.update('api::campaign.campaign', campaign.id, {
      data: {
        user: updatedUser,
      }
    });

    ctx.body = updatedCampaign;
  },

}));

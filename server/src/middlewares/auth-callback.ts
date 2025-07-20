const { jwtDecode } = require('jwt-decode');

module.exports = (config, { strapi }) => {
    return async (ctx, next) => {

        if (ctx.url.includes('/api/auth/auth0/callback')) {
            await next();

            const user = ctx.response.body?.user;

            if (ctx.response.status === 200 && user) {
                const userId = user.id;
                const tokenData = jwtDecode(ctx.query.id_token);
                const { name, picture } = tokenData;

                if (name && picture && (user.name !== name || user.picture !== picture)) {
                    try {
                        await strapi.query('plugin::users-permissions.user').update({
                            where: { id: userId },
                            data: {
                                name,
                                picture,
                            }
                        });
                    } catch (error) {
                        console.error('Error creating/updating user info on callback', error);
                    }
                }

                const currentCampaign =
                    await strapi.controller('api::campaign.campaign').getCurrentCampaignInternal(ctx);

                if (currentCampaign) {
                    const isUserInCampaign = currentCampaign.user?.some(
                        campaignUser => campaignUser?.users_permissions_user?.id === userId
                    )

                    if (!isUserInCampaign) {
                        const newCampaignUser = {
                            played_the_game: false,
                            finished_the_game: false,
                            suggested_a_game: false,
                            partook_in_the_meeting: false,
                            users_permissions_user: userId,
                        };

                        await strapi.entityService.update('api::campaign.campaign', currentCampaign.id, {
                            data: {
                                user: [ ...(currentCampaign.user || []), newCampaignUser ],
                            },
                        });
                    }
                }
            }

        } else {
            await next();
        }

    }
}

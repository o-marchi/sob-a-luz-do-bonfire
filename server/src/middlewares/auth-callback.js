module.exports = (config, { strapi }) => {
    return async (ctx, next) => {

        await next();

        if (ctx.url.includes('/api/auth/discord/callback')) {
          console.log('We are in');
            const user = ctx.response.body?.user;
            const accessToken = ctx.query.access_token;

            if (ctx.response.status === 200 && user && accessToken) {
                const userId = user.id;

                /**
                 * Fetch user discord info
                 * Save discord info into user entry
                 */
                try {
                    const discordUserResponse = await fetch('https://discord.com/api/users/@me', {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    });

                    if (!discordUserResponse.ok) {
                        throw new Error(`Discord API responded with status: ${discordUserResponse.status}`);
                    }

                    const discordUser = await discordUserResponse.json() || {};
                    const avatarUrl = discordUser.avatar
                        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
                        : null;

                    const updatedUser = await strapi.query('plugin::users-permissions.user').update({
                        where: { id: userId },
                        data: {
                            global_name: discordUser.global_name || discordUser.username,
                            avatar: avatarUrl,
                            accent_color: discordUser.accent_color || null,
                            banner_color: discordUser.banner_color || null,
                        }
                    });

                    ctx.body.user = {
                        ...ctx.body.user,
                        global_name: updatedUser.global_name,
                        avatar: updatedUser.avatar,
                        accent_color: updatedUser.accent_color,
                        banner_color: updatedUser.banner_color,
                    };

                } catch (error) {
                    console.error('Error updating user with Discord information:', error);
                }

                /**
                 * Insert user, if they are not already, into the current campaign
                 */
                try {
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
                } catch (error) {
                    console.error('Error inserting user into current campaign:', error);
                }

            }
        }

    }
}

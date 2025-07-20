
module.exports = {
    routes: [
        {
            method: 'GET',
            path: '/current-campaign',
            handler: 'campaign.getCurrentCampaign',
            config: {
                auth: false
            },
        },
        {
            method: 'POST',
            path: '/update-player-game-information',
            handler: 'campaign.updatePlayerGameInformation',
            config: {
                auth: {
                    required: true,
                }
            },
        },
    ],
};

import type { Schema, Struct } from '@strapi/strapi';

export interface CampaignUserCampaignUser extends Struct.ComponentSchema {
  collectionName: 'components_campaign_user_campaign_users';
  info: {
    displayName: 'Campaign User';
    icon: 'user';
  };
  attributes: {
    finished_the_game: Schema.Attribute.Boolean;
    partook_in_the_meeting: Schema.Attribute.Boolean;
    played_the_game: Schema.Attribute.Boolean;
    suggested_a_game: Schema.Attribute.Boolean;
    users_permissions_user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'campaign-user.campaign-user': CampaignUserCampaignUser;
    }
  }
}

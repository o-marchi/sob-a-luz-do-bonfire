import { CollectionConfig } from 'payload/types'

export const Players: CollectionConfig = {
  slug: 'players',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'discord',
      type: 'group',
      fields: [
        {
          name: 'discordId',
          type: 'text',
        },
        {
          name: 'username',
          type: 'text',
        },
        {
          name: 'global_name',
          type: 'text',
        },
        {
          name: 'avatar',
          type: 'text',
        },
      ],
    },
  ],
}

import type { CollectionConfig } from 'payload'

export const Campaigns: CollectionConfig = {
  slug: 'campaigns',
  admin: {
    useAsTitle: 'month',
  },
  access: {
    read: () => true,
  },
  defaultPopulate: {
    game: {
      title: true,
    },
  },
  fields: [
    {
      name: 'month',
      type: 'text',
      required: true,
    },
    {
      name: 'year',
      type: 'text',
    },
    {
      name: 'current',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'heroDescription',
      type: 'richText',
    },
    {
      name: 'game',
      type: 'relationship',
      relationTo: 'games',
    },
    {
      name: 'election',
      type: 'group',
      fields: [
        {
          name: 'active',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'electionOptions',
          type: 'array',
          fields: [
            {
              name: 'game',
              type: 'relationship',
              relationTo: 'games',
              required: true,
            },
            {
              name: 'voters',
              type: 'array',
              fields: [
                {
                  name: 'player',
                  type: 'relationship',
                  relationTo: 'players',
                },
              ],
            },
            {
              name: 'tokens',
              type: 'number',
              admin: {
                readOnly: true,
              },
              hooks: {
                beforeChange: [
                  ({ data, siblingData }) => {
                    const players = data?.players || []

                    return (siblingData?.voters || []).reduce((acc, voter) => {
                      const player = players.find((p) => p.player === voter.player)
                      return acc + (player?.tokens || 0)
                    }, 0)
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: 'players',
      type: 'array',
      fields: [
        {
          name: 'player',
          type: 'relationship',
          relationTo: 'players',
          required: true,
        },
        {
          name: 'played_the_game',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'finished_the_game',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'suggested_a_game',
          type: 'text',
        },
        {
          name: 'partook_in_the_meeting',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'tokens',
          type: 'number',
          admin: {
            readOnly: true,
          },
          hooks: {
            beforeChange: [
              ({ siblingData }) => {
                let tokens = 1

                if (siblingData.played_the_game) {
                  tokens += 1
                }

                if (siblingData.finished_the_game) {
                  tokens += 1
                }

                if (siblingData.partook_in_the_meeting) {
                  tokens += 1
                }

                if (siblingData.suggested_a_game && siblingData.suggested_a_game.trim()) {
                  tokens -= 1
                }

                return tokens
              },
            ],
          },
        },
      ],
    },
  ],
}

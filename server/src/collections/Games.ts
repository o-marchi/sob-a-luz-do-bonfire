import { CollectionConfig } from 'payload/types'

export const Games: CollectionConfig = {
  slug: 'games',
  admin: {
    useAsTitle: 'title',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'cover',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'suggestion',
      type: 'checkbox',
    },
  ],
}

import type { CollectionConfig } from 'payload'

export const Players: CollectionConfig = {
  slug: 'players',
  admin: {
    useAsTitle: 'name',
  },
  // auth: {
  //   strategies: [
  //     {
  //       name: 'custom-strategy',
  //       authenticate: async ({ payload, headers }) => {
  //
  //         return false;
  //
  //         // console.log(payload.login);
  //         // // console.log(payload.req.url);
  //         // //
  //         // // if (payload.req.url.startsWith('/admin')) {
  //         // //   return false; // This tells Payload to try the next strategy
  //         // // }
  //         //
  //         // const authHeader = headers?.get('Authorization')
  //         // const token = authHeader?.replace('Bearer ', '')
  //         //
  //         // console.log('----------------------')
  //         // console.log(token)
  //         // console.log('----------------------')
  //         //
  //         // if (!token) {
  //         //   return null;
  //         // }
  //         //
  //         // const playerDocs = await payload.find({
  //         //   collection: 'players',
  //         //   where: {
  //         //     id: 1
  //         //   },
  //         // })
  //         //
  //         // if (!playerDocs.docs.length) {
  //         //   return { user: null };
  //         // }
  //         //
  //         // return {
  //         //   user: playerDocs.docs[0],
  //         //   collection: 'players'
  //         // }
  //       }
  //     }
  //   ]
  // },
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
      ]
    },
  ]
}

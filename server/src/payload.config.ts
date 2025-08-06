// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp' // sharp-import
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { Users } from './collections/Users'
import { Media } from '@/collections/Media'
import { Games } from '@/collections/Games'
import { Campaigns } from '@/collections/Campaigns'
import { Players } from '@/collections/Players'

import {
  discordAuthEndpoint,
  discordCallbackEndpoint,
  testEndpoint,
} from './endpoints/auth.endpoints'
import { getCurrentCampaign, updatePlayerGameInformation } from '@/endpoints/campaign.endpoints'
import { r2Storage } from '@/plugins/storage'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  collections: [Users, Media, Games, Campaigns, Players],
  cors: '*',
  plugins: [r2Storage],
  endpoints: [
    {
      path: '/health',
      method: 'get',
      handler: async (req) => {
        return new Response('OK', { status: 200 })
      },
    },

    // Discord Auth
    discordAuthEndpoint,
    discordCallbackEndpoint,
    testEndpoint,

    // Campaign
    getCurrentCampaign,
    updatePlayerGameInformation,
  ],
  secret: process.env.PAYLOAD_SECRET as string,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})

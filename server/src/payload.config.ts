// storage-adapter-import-placeholder
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Games } from './collections/Games'
import { Campaigns } from './collections/Campaigns'
import { Players } from './collections/Players'

import {
  discordAuthEndpoint,
  discordCallbackEndpoint,
  testEndpoint,
} from '@/endpoints/auth.endpoints'
import { getCurrentCampaign, updatePlayerGameInformation } from '@/endpoints/campaign.endpoints'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  cors: '*',
  defaultDepth: 9,
  collections: [Users, Media, Games, Campaigns, Players],
  editor: lexicalEditor(),
  endpoints: [
    // Discord Auth
    discordAuthEndpoint,
    discordCallbackEndpoint,
    testEndpoint,

    // Campaign
    getCurrentCampaign,
    updatePlayerGameInformation,
  ],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db:
    (process.env.DATABASE || 'postgres') === 'postgres'
      ? postgresAdapter({
          pool: {
            connectionString: process.env.DATABASE_URI || '',
          },
        })
      : sqliteAdapter({
          client: {
            url: process.env.DATABASE_URI || '',
          },
        }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
  ],
})

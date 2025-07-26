import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import sharp from 'sharp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { Users } from './collections/Users'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: lexicalEditor(),
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
  collections: [Users],
  cors: '*',
  defaultDepth: 9,
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
  ],
  endpoints: [
    {
      path: '/health',
      method: 'get',
      handler: async (req) => {
        return new Response('OK', { status: 200 })
      },
    },
  ],
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})

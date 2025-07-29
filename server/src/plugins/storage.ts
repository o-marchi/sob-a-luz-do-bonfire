import { s3Storage } from '@payloadcms/storage-s3'
import * as process from 'node:process'

export const r2Storage = s3Storage({
  collections: {
    media: {
      disableLocalStorage: true,
      prefix: 'sobaluz',
    },
  },
  bucket: process.env.R2_BUCKET as string,
  config: {
    endpoint: process.env.R2_ENDPOINT as string,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
    region: 'auto',
    forcePathStyle: true,
  },
})

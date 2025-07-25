import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  outputFileTracingIncludes: {
    './**/*': ['./node_modules/@libsql/linux*/**/*'],
  },

  // Your Next.js config here
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },

  experimental: {
    serverActions: {
      allowedOrigins: ['*'],
      logging: 'verbose',
    },
  },

  logging: {
    fetches: {
      fullUrl: true,
    },
    incomingRequests: true,
  },
}

export default withPayload(nextConfig, {
  devBundleServerPackages: false,
  payLoadConfig: {
    logErrors: true,
    debug: true,
    errors: {
      expose: true,
    },
  },
})

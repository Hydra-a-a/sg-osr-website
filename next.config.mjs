import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1'],

  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
      bodySizeLimit: '1mb'
    }
  },
  images: {
    minimumCacheTTL: 86400,
    qualities: [70, 75, 78],
    remotePatterns: [
      { protocol: 'https', hostname: '*.googleusercontent.com' },
      { protocol: 'https', hostname: 'www.google.com' },
      { protocol: 'https', hostname: '*.fbcdn.net' },
      { protocol: 'https', hostname: '*.facebook.com' },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  }
};

const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
  },
};

// The Sentry webpack plugin is a production build concern. Keeping it out of
// `next dev` avoids route-manifest/source-map setup on every local config load
// while runtime instrumentation remains available through instrumentation.ts.
export default process.env.NODE_ENV === 'development'
  ? nextConfig
  : withSentryConfig(nextConfig, sentryBuildOptions);

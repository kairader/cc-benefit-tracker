import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const basePath = '/cc-benefit-tracker'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Credit Tracker',
    short_name: 'Credits',
    description: 'Track credit card benefits',
    start_url: basePath,
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    orientation: 'portrait',
    icons: [
      {
        src: `${basePath}/icon-192`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${basePath}/icon-512`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}

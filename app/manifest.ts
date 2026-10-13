import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

// Empty on Vercel previews, '/cc-benefit-tracker' on GitHub Pages.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Credit Tracker',
    short_name: 'Credits',
    description: 'Track credit card benefits',
    // No start_url: a Home Screen app opens the page it was added from, so the
    // onboarding demo can be added and recorded full screen.
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    orientation: 'portrait',
    icons: [
      {
        src: `${basePath}/icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${basePath}/icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}

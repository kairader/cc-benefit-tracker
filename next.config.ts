import type { NextConfig } from "next";

// GitHub Pages serves the app under /cc-benefit-tracker; Vercel previews serve it at the root.
const basePath = process.env.VERCEL ? '' : '/cc-benefit-tracker'

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  // Plain <img> tags don't get the base path, so hand it to the client.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;

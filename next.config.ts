import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // GitHub Pages serves the app under /cc-benefit-tracker; Vercel previews serve it at the root.
  basePath: process.env.VERCEL ? '' : '/cc-benefit-tracker',
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;

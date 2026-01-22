import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/cc-benefit-tracker',
  images: { unoptimized: true },
};

export default nextConfig;

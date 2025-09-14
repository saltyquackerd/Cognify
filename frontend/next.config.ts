import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Fix workspace root detection issue
  outputFileTracingRoot: '.',
  // Remove experimental.esmExternals as it's not supported with Turbopack
  // and not needed for static export
};

export default nextConfig;

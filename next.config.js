/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    // Force chinese-days to use CJS build (main) instead of ESM (module)
    config.resolve.alias['chinese-days'] = require.resolve('chinese-days');
    return config;
  },
}

module.exports = nextConfig

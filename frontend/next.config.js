/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'localhost:9641',
          },
        ],
        destination: 'http://neo.iu/:path*',
        permanent: false,
      },
    ];
  },
}

module.exports = nextConfig

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: isProd ? 'export' : undefined,
  ...(isProd ? {} : {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:4111/api/:path*' // Proxy to Mastra Express backend
        }
      ]
    }
  })
};

export default nextConfig;


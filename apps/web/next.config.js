/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crm/shared', '@crm/api-client'],
  output: 'standalone',
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Don’t run ESLint during Vercel builds (you can enable later)
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

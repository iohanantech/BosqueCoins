/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    dirs: ["src", "prisma", "scripts", "tests"],
  },
};

module.exports = nextConfig;

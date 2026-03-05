import type { NextConfig } from "next";
const withPWA = require("next-pwa");

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
})(nextConfig);

// Empty turbopack config to silence webpack config warning
export const turbopack = {};

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Vercel and local build use this directory as root (avoids lockfile warning)
  turbopack: { root: __dirname },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Vercel and local build use this directory as root (avoids lockfile warning)
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "lipdyycqbuvibgxcckjd.supabase.co" },
    ],
  },
};

export default nextConfig;

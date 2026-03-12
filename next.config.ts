import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Vercel and local build use this directory as root (avoids lockfile warning)
  turbopack: { root: __dirname },
  experimental: {
    optimizePackageImports: ["lucide-react", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "lipdyycqbuvibgxcckjd.supabase.co" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photos are shrunk on the phone first; this leaves room for up to 4 Curb photos
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;

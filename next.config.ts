import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Porch photos are shrunk on the phone first; this leaves room for a full-size one
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;

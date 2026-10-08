import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts runs on every request; its default 10 MB body cap would truncate
    // 50 MB evidence clips (lib/evidence.ts) before the upload route sees them.
    proxyClientMaxBodySize: "51mb",
  },
};

export default nextConfig;

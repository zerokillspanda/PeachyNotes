import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
  serverExternalPackages: ["mammoth", "@cedrugs/pdf-parse"],
};

export default nextConfig;

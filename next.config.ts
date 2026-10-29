import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Legacy card scans on Azure Blob (public, pre-optimized ~300px). TODO:
    // add the Supabase Storage host once the asset copy (P1) lands.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cardcheckliststorage.blob.core.windows.net",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

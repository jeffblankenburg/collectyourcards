import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Allow the dev server's LAN origin so you can test the PWA on a phone/tablet
  // over Wi-Fi (dev-only; no effect on production). Add more LAN IPs here as needed.
  allowedDevOrigins: ["192.168.4.39"],
  images: {
    remotePatterns: [
      // Legacy card scans + existing user-card photos on Azure Blob (public).
      {
        protocol: "https",
        hostname: "cardcheckliststorage.blob.core.windows.net",
      },
      // New per-copy card photos in Supabase Storage (card-photos bucket).
      {
        protocol: "https",
        hostname: "dlcauqpviuejzoqfifai.supabase.co",
        pathname: "/storage/v1/object/**",
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

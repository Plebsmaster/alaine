import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Importbestanden gaan via een Server Action; Vercel staat tot 4,5 MB toe.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import { buildCsp } from "./lib/csp";

// Admin and account pages get a per-request nonce policy from proxy.ts instead.
const publicCsp = buildCsp({
  isDev: process.env.NODE_ENV === "development",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mapTiles: true, // the Areas page's OpenStreetMap map
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  logging: {
    serverFunctions: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Everything except /admin, /account and what's under them.
        source: "/:path((?!(?:admin|account)(?:/|$)).*)",
        headers: [{ key: "Content-Security-Policy", value: publicCsp }],
      },
    ];
  },
};

export default nextConfig;

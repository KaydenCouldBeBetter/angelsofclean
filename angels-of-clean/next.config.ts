import type { NextConfig } from "next";
import { buildCsp } from "./lib/csp";

// Admin pages get a per-request nonce policy from middleware.ts instead.
const publicCsp = buildCsp({
  isDev: process.env.NODE_ENV === "development",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
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
        // Everything except /admin and /admin/*.
        source: "/:path((?!admin(?:/|$)).*)",
        headers: [{ key: "Content-Security-Policy", value: publicCsp }],
      },
    ];
  },
};

export default nextConfig;

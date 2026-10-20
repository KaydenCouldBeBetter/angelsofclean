import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Run the suite in a non-Eastern process zone by default so timezone bugs
// (server-local date math, missing timeZone in formatters) surface in CI.
// Set before workers spawn so they inherit it. Override with e.g.
// `TZ=America/Los_Angeles npx vitest` to prove zone-independence.
process.env.TZ = process.env.TZ ?? "UTC";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

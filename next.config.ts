import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.DEVLOG_PLAYWRIGHT === "1" ? ".next/playwright" : ".next",
  serverExternalPackages: ["pino", "pino-pretty"],
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

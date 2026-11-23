import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.DEVLOG_DOCKER_BUILD === "1" ? { output: "standalone" } : {}),
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

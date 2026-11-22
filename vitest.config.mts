import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "server-only": fileURLToPath(new URL("./test/stubs/serverOnly.ts", import.meta.url)),
};

const exclude = ["node_modules/**", "e2e/**", "eslint-fixtures/**", ".next/**"];

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "test/**/*.test.ts"],
          exclude,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", "test/**/*.test.tsx"],
          exclude,
        },
      },
    ],
  },
});

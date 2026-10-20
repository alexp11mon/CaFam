import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/setup-unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Loads .env.test.local: tests hit the Supabase `dev` project (plan D8).
          env: loadEnv("test", process.cwd(), ""),
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // Files share one remote project; run them one at a time to avoid auth rate limits.
          fileParallelism: false,
        },
      },
    ],
  },
});

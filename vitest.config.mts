import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js's "server-only" guard throws outside Next; tests run on the server anyway.
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});

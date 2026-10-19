// Runs one-off helper scripts (scripts/*.script.ts) with the app's "@/" imports working.
//   npx vitest run -c vitest.scripts.mts seed-porch
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: { include: ["scripts/**/*.script.ts"], testTimeout: 120_000 },
});

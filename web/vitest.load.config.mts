import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate config (rather than fighting include/exclude precedence on the
// main one) purely so `npm run test:load` runs ONLY pos.load.test.ts —
// slow and heavy by design, not part of the regular `npm test` pass.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "server-only": path.resolve(import.meta.dirname, "./vitest.server-only-shim.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/pos.load.test.ts"],
    testTimeout: 120_000,
  },
});

import { defineConfig, defaultExclude } from "vitest/config";
import path from "node:path";

// Node environment, not jsdom — these tests exercise server-side logic
// (Prisma-backed integration tests, pure calculation functions) rather than
// rendering React components. Path alias mirrors tsconfig.json's "@/*" so
// test files can import the same way app code does.
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
    // Concurrency/integration tests hit the real dev database and take
    // longer than typical unit tests — this is the module under test, not
    // test overhead, so the default 5s timeout isn't generous enough.
    testTimeout: 20_000,
    // The load test (pos.load.test.ts) runs on its own via `npm run
    // test:load` (see vitest.load.config.ts) — it's slow and heavy by
    // design, not something that belongs in the regular `npm test` pass.
    exclude: [...defaultExclude, "**/pos.load.test.ts"],
  },
});

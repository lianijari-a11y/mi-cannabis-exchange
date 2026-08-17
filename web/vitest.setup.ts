import { vi } from "vitest";

// Next.js loads .env automatically; a plain `vitest` process doesn't, and
// the Prisma client (used directly by the integration tests) needs
// DATABASE_URL/DIRECT_URL set before it's imported. Node 20.6+ ships
// loadEnvFile natively — no dotenv dependency needed.
try {
  process.loadEnvFile(".env");
} catch {
  // Already loaded (e.g. by the shell) or no .env file present — either way
  // there's nothing to do here.
}

// next/server's after() throws when called outside an actual Next.js
// request scope ("`after` was called outside a request scope") — which
// every test run is, since these tests call server functions like
// createSale directly rather than through a real HTTP request. lib/pos.ts
// uses after() to move the METRC submission off the checkout critical path
// (see the POS hardening plan's Phase 2); tests care about the DB-level
// result of createSale, not about actually firing a METRC call, so this
// shims after() to just run the callback immediately instead. Production
// behavior is untouched — this only applies inside the test process.
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (fn: () => void | Promise<void>) => {
      void fn();
    },
  };
});

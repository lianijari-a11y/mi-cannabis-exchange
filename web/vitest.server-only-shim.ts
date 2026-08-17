// "server-only" isn't a real resolvable npm package — Next.js's own
// bundler (webpack/turbopack) special-cases it internally so that
// `import "server-only"` throws if that module ever ends up in a client
// bundle. Vite/Vitest has no equivalent special-casing and can't resolve
// the bare specifier at all, so vitest.config.ts aliases "server-only" to
// this empty, side-effect-free shim instead. Tests run entirely server-side
// already (Node environment, no bundling into a client chunk), so there's
// nothing for the real package's guard to actually protect against here.
export {};

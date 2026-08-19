import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Every photo/video/document upload in this app goes through a
      // Server Action (see lib/media.ts) — Next's own default cap is 1MB,
      // which a real phone photo already exceeds. Raised as far as makes
      // sense given Vercel's own platform-level request-body ceiling for a
      // standard serverless function invocation (~4.5MB) — going higher
      // here wouldn't help on Vercel specifically, since the request would
      // be rejected before this config is even consulted. Large video
      // uploads still need a different architecture (client uploads
      // directly to Vercel Blob via a signed token, bypassing the
      // function's body entirely) — not built yet, flagged as a real,
      // known gap rather than silently capped.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;

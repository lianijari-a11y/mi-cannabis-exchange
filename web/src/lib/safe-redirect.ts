// Both login and signup accept an optional callbackUrl (e.g. so a retailer
// completing account creation from a shared listing link, CLAUDE.md §36,
// lands back on that listing) — this is user-controlled form data, so it
// must never be handed straight to a redirect. Only a same-site relative
// path is accepted; anything else (an absolute URL, or a "//host" that
// browsers treat as protocol-relative) falls back to the safe default.
export function safeRedirect(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  if (!url.startsWith("/") || url.startsWith("//")) return fallback;
  return url;
}

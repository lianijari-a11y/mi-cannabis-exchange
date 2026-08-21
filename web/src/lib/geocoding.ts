import "server-only";

// Grower/processor/retailer addresses have always been free text with no
// validation — a documented, known gap. This fills it in: given the
// address fields already collected at signup, look up real coordinates
// via Google's Geocoding API. Same "not configured" honest-fallback
// convention as every other optional external API in this app
// (lib/ai-listing.ts, lib/email.ts) — without GOOGLE_MAPS_API_KEY set,
// this quietly returns null and the address just stays free text, same
// as it always has.
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export function isGeocodingConfigured(): boolean {
  return !!GOOGLE_MAPS_API_KEY;
}

export type GeocodeResult = { lat: number; lng: number; formattedAddress: string };

export async function geocodeAddress(
  address: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined
): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const full = [address, city, state, zip].filter(Boolean).join(", ");
  if (!full.trim()) return null;

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", full);
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);
    // Michigan-only marketplace — biasing results to MI avoids a
    // same-named street in another state winning the match.
    url.searchParams.set("region", "us");
    url.searchParams.set("components", "administrative_area:MI|country:US");

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return null;

    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  } catch {
    // Network failure, malformed response, etc. — a failed geocode should
    // never block signup or any other flow that calls this; the address
    // stays exactly as the user typed it.
    return null;
  }
}

/**
 * Only allow HTTPS links to Google Maps / Google Business review destinations.
 * These URLs are provided by individual business owners and rendered as outbound
 * links in the customer's Explore Businesses directory.
 */
export type GoogleBusinessLinkKind = "maps" | "reviews";

export function normalizeGoogleBusinessLink(value: unknown, kind: GoogleBusinessLinkKind): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("Enter a valid Google Maps or Google Reviews URL.");
  const input = value.trim();
  if (!input) return null;
  if (input.length > 1200) throw new Error("Google link is too long (maximum 1200 characters).");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Paste the full Google HTTPS link, starting with https://.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("Google links must use a secure HTTPS address.");
  }
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const isMapsShort = host === "maps.app.goo.gl" || (host === "goo.gl" && path.startsWith("/maps"));
  const isGoogleMaps = (/^(www\.|maps\.)?google\.(com|[a-z]{2}|co\.[a-z]{2})$/.test(host) && (path === "/maps" || path.startsWith("/maps/") || host.startsWith("maps.")));
  const isGPageReview = host === "g.page" && (/^\/r\/[^/]+\/review\/?$/.test(path) || /^\/[^/]+\/review\/?$/.test(path));
  const isSearchReview = host === "search.google.com" && path === "/local/writereview" && Boolean(url.searchParams.get("placeid"));
  if (kind === "maps" && !(isGoogleMaps || isMapsShort || host === "g.page")) {
    throw new Error("Paste a genuine Google Maps location link.");
  }
  if (kind === "reviews" && !(isGPageReview || isSearchReview)) {
    throw new Error("Paste the direct Google 'Get more reviews' link, not a normal Maps location link.");
  }
  return url.toString();
}

export function isGoogleBusinessLink(value: string, kind: GoogleBusinessLinkKind): boolean {
  try {
    return normalizeGoogleBusinessLink(value, kind) !== null;
  } catch {
    return false;
  }
}

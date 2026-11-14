export const WISHLIST_KEY = "emarketplace.wishlist.v1";

export function parseWishlist(raw: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 128))] : [];
  } catch { return []; }
}

export function toggleWishlist(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
}

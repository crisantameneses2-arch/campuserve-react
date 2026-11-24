/*
 * Items CampuServe no longer offers. They may still exist in the
 * Firestore `inventory` collection, so every inventory list filters
 * them out with this check.
 */
export function isRetiredItem(itemName: unknown): boolean {
  return /\brotc\b/i.test(String(itemName ?? ""));
}

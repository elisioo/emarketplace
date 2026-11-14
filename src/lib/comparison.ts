export const MAX_COMPARISON_ITEMS = 3;

export function toggleComparison(ids: readonly string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter(value => value !== id);
  if (ids.length >= MAX_COMPARISON_ITEMS) return [...ids];
  return [...ids, id];
}

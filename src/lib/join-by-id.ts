/** Two lists as one, in order, keeping the first of any entries that share an id. */
export function joinById<T extends { id: string }>(first: readonly T[], second: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...first, ...second]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

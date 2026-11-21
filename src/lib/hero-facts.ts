import type { Meta } from "@/lib/cinemeta";

const MAX_GENRES = 2;

/**
 * The plain facts under a hero's title, in reading order: when, how long,
 * what kind. Scores are not facts of this kind and are drawn beside the line.
 */
export function heroFacts(meta: Pick<Meta, "releaseInfo" | "runtime" | "genres">): string[] {
  const facts: string[] = [];
  const when = meta.releaseInfo?.trim();
  if (when) facts.push(when);
  const length = meta.runtime?.trim();
  if (length) facts.push(length);
  const kinds = (meta.genres ?? []).map((g) => g.trim()).filter(Boolean);
  if (kinds.length > 0) facts.push(kinds.slice(0, MAX_GENRES).join(", "));
  return facts;
}

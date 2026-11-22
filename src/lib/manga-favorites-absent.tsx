import type { ReactNode } from "react";
import type { MangaFavoritesStore } from "./manga-favorites";
import { MangaFavoritesContext } from "./manga-favorites-context";

// The edition without Manga (lib/features/edition.ts). Menus and the library still ask for
// manga favorites wherever they are mounted, so they are answered with none; the real
// provider is left out because it brings every manga source with it.
const NONE: MangaFavoritesStore = {
  items: new Map(),
  has: () => false,
  toggle: () => ({ ok: false, reason: "storage", quota: false }),
  repair: () => {},
  count: 0,
};

export function NoMangaFavorites({ children }: { children: ReactNode }) {
  return <MangaFavoritesContext.Provider value={NONE}>{children}</MangaFavoritesContext.Provider>;
}

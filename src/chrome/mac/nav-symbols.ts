import type { NavItemId } from "@/chrome/nav-items";

/** SF Symbol for each navigation item in the native macOS sidebar. */
export const NAV_SYMBOLS: Record<NavItemId, string> = {
  home: "house",
  discover: "safari",
  catalogs: "square.grid.2x2",
  plugins: "puzzlepiece.extension",
  movies: "film",
  shows: "tv",
  music: "music.note",
  games: "gamecontroller",
  kids: "popcorn",
  anime: "sparkles.tv",
  manga: "book.pages",
  ebook: "book",
  live: "dot.radiowaves.left.and.right",
  sports: "sportscourt",
  vod: "play.rectangle.on.rectangle",
  calendar: "calendar",
  library: "books.vertical",
  collections: "rectangle.stack",
  downloads: "arrow.down.circle",
  addons: "puzzlepiece",
  settings: "gearshape",
};

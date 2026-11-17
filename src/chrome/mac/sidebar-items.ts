import { NAV_SYMBOLS } from "./nav-symbols";

// Pure mapping from Harbor's sidebar navigation to what the native macOS
// sidebar shows. Mirrors Swift's SidebarItem (macos/HarborNative Payloads.swift).

export type NativeSidebarSectionId = "browse" | "library" | "more";

export type NativeSidebarItem = {
  id: string;
  title: string;
  symbol: string;
  section: NativeSidebarSectionId;
  active: boolean;
  gated: boolean;
  badge?: number;
};

export type NativeSidebarSection = { id: NativeSidebarSectionId; title: string | null };

/** The parts of a `useSidebarNavigation()` entry the native sidebar needs. */
export type SidebarEntryLike = {
  item: { id: string; label: string; view: string };
  primary: boolean;
  gated: boolean;
};

export const KIDS_PLAY_ID = "kids-play";
const SETTINGS_ID = "settings";

// The Apple TV-style grouping. Each list is also the group's default order.
const GROUPS: Record<NativeSidebarSectionId, readonly string[]> = {
  browse: ["home", "discover", "movies", "shows", "kids", "anime", "live", "sports", "vod"],
  library: ["library", "collections", "downloads", "calendar"],
  more: ["catalogs", "music", "games", "manga", "ebook", "addons", "plugins"],
};
const SECTION_ORDER: readonly NativeSidebarSectionId[] = ["browse", "library", "more"];

function sectionOf(id: string): NativeSidebarSectionId {
  return SECTION_ORDER.find((section) => GROUPS[section].includes(id)) ?? "more";
}

export function buildNativeSidebar(
  entries: readonly SidebarEntryLike[],
  view: string,
  t: (key: string) => string,
  opts: {
    renamed: Record<string, string>;
    kid: boolean;
    reminderCount: number;
    /** The user arranged navigation themselves; keep their order within each group. */
    customOrder: boolean;
  },
): {
  items: NativeSidebarItem[];
  sections: NativeSidebarSection[];
  /** The Settings entry, shown at the sidebar's foot; null when not available. */
  settings: NativeSidebarItem | null;
} {
  const mapped = entries.map(({ item, gated }): NativeSidebarItem => {
    const out: NativeSidebarItem = {
      id: item.id,
      title: opts.renamed[item.id] ?? t(item.label),
      symbol: (NAV_SYMBOLS as Record<string, string | undefined>)[item.id] ?? "circle",
      section: sectionOf(item.id),
      active: item.view === view,
      gated,
    };
    if (item.id === "calendar" && opts.reminderCount > 0) out.badge = opts.reminderCount;
    return out;
  });
  const settings = mapped.find((item) => item.id === SETTINGS_ID) ?? null;
  const items = SECTION_ORDER.flatMap((section) => {
    const group = mapped.filter((item) => item.section === section && item.id !== SETTINGS_ID);
    if (opts.customOrder) return group;
    const rank = (id: string) => {
      const at = GROUPS[section].indexOf(id);
      return at === -1 ? GROUPS[section].length : at;
    };
    return group.sort((a, b) => rank(a.id) - rank(b.id));
  });
  if (opts.kid) {
    const play: NativeSidebarItem = {
      id: KIDS_PLAY_ID,
      title: "Play",
      symbol: "play.circle",
      section: "browse",
      active: false,
      gated: false,
    };
    // After the last browse row, so it stays in the unlabelled first group.
    const browseCount = items.filter((item) => item.section === "browse").length;
    items.splice(browseCount, 0, play);
  }
  return {
    items,
    sections: [
      { id: "browse", title: null },
      { id: "library", title: t("Library") },
      { id: "more", title: t("More") },
    ],
    settings,
  };
}

/** Two characters for the profile circle at the sidebar's foot. */
export function profileInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

/** Where a clicked sidebar id leads, and whether the parental PIN stands in the way. */
export function findSidebarTarget(
  entries: readonly SidebarEntryLike[],
  id: string,
): { view: string; gated: boolean } | null {
  const entry = entries.find((candidate) => candidate.item.id === id);
  return entry ? { view: entry.item.view, gated: entry.gated } : null;
}

/**
 * What a "Go" command from the menu bar may do. The menu always lists its
 * pages, but the sidebar may have dropped one: for a kid profile, behind the
 * parental lock, or just by preference.
 */
export function menuNavigation(
  entries: readonly SidebarEntryLike[],
  view: string,
  state: { locked: boolean; kid: boolean },
): "go" | "pin" | "ignore" {
  const entry = entries.find((candidate) => candidate.item.view === view);
  if (entry) return entry.gated ? "pin" : "go";
  if (state.kid) return "ignore";
  return state.locked ? "pin" : "go";
}

/** Same conditions the React sidebar is rendered under, plus hidden chrome. */
export function sidebarVisible(state: {
  settingsTop: boolean;
  playerActive: boolean;
  standaloneLive: boolean;
  pickerTop: boolean;
  immersive: boolean;
  chromeHidden: boolean;
}): boolean {
  return (
    !state.settingsTop &&
    !state.playerActive &&
    !state.standaloneLive &&
    !state.pickerTop &&
    !state.immersive &&
    !state.chromeHidden
  );
}

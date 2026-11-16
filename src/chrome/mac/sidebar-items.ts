import { NAV_SYMBOLS } from "./nav-symbols";

// Pure mapping from Harbor's sidebar navigation to what the native macOS
// sidebar shows. Mirrors Swift's SidebarItem (macos/HarborNative Payloads.swift).

export type NativeSidebarItem = {
  id: string;
  title: string;
  symbol: string;
  section: "primary" | "collections";
  active: boolean;
  gated: boolean;
  badge?: number;
};

/** The parts of a `useSidebarNavigation()` entry the native sidebar needs. */
export type SidebarEntryLike = {
  item: { id: string; label: string; view: string };
  primary: boolean;
  gated: boolean;
};

export const KIDS_PLAY_ID = "kids-play";

export function toNativeSidebarItems(
  entries: readonly SidebarEntryLike[],
  view: string,
  t: (key: string) => string,
  opts: { renamed: Record<string, string>; kid: boolean; reminderCount: number },
): NativeSidebarItem[] {
  const items = entries.map(({ item, primary, gated }): NativeSidebarItem => {
    const mapped: NativeSidebarItem = {
      id: item.id,
      title: opts.renamed[item.id] ?? t(item.label),
      symbol: (NAV_SYMBOLS as Record<string, string | undefined>)[item.id] ?? "circle",
      section: primary ? "primary" : "collections",
      active: item.view === view,
      gated,
    };
    if (item.id === "calendar" && opts.reminderCount > 0) mapped.badge = opts.reminderCount;
    return mapped;
  });
  if (opts.kid) {
    items.push({
      id: KIDS_PLAY_ID,
      title: "Play",
      symbol: "play.circle",
      section: "primary",
      active: false,
      gated: false,
    });
  }
  return items;
}

/** Where a clicked sidebar id leads, and whether the parental PIN stands in the way. */
export function findSidebarTarget(
  entries: readonly SidebarEntryLike[],
  id: string,
): { view: string; gated: boolean } | null {
  const entry = entries.find((candidate) => candidate.item.id === id);
  return entry ? { view: entry.item.view, gated: entry.gated } : null;
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

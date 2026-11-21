// While Settings is open, the native macOS sidebar lists the settings pages
// instead of Harbor's navigation, the way System Settings does. The Settings
// page publishes its pages here; NativeSidebarBridge shows them and sends the
// clicks back.

export const SETTINGS_ROW_PREFIX = "settings-page:";

/** SF Symbol for each Settings page. An unknown name falls back to a circle in Swift. */
export const SETTINGS_SYMBOLS: Record<string, string> = {
  basics: "checklist",
  account: "person.crop.circle",
  trackers: "arrow.triangle.2.circlepath",
  relay: "antenna.radiowaves.left.and.right",
  player: "play.rectangle",
  mpv: "slider.horizontal.3",
  shaders: "wand.and.stars",
  anime: "sparkles.tv",
  language: "globe",
  subtitles: "captions.bubble",
  streaming: "server.rack",
  streamFilters: "line.3.horizontal.decrease.circle",
  p2p: "point.3.connected.trianglepath.dotted",
  library: "books.vertical",
  plugins: "puzzlepiece.extension",
  theme: "paintpalette",
  playerLayout: "rectangle.3.group",
  badges: "tag",
  awardIcons: "trophy",
  hotkeys: "keyboard",
  controllers: "gamecontroller",
  remotes: "av.remote",
  tv: "tv",
  bigPicture: "rectangle.inset.filled",
  storage: "internaldrive",
  webhooks: "bell.badge",
  advanced: "gearshape.2",
  bug: "ladybug",
  support: "heart",
  licenses: "doc.text",
  icons: "square.grid.2x2",
  updates: "arrow.down.circle",
};

export type SettingsSidebarItem = {
  id: string;
  title: string;
  symbol: string;
  section: string;
  active: boolean;
  gated: false;
};

export type SettingsSidebar = {
  items: SettingsSidebarItem[];
  /** A section without a title is listed with no heading. */
  sections: { id: string; title: string | null }[];
};

/** The row under the pages that shows or hides the pages a Mac starts without. Not a page. */
export const SETTINGS_SHOW_ALL_ROW = "show-all";

/** The native sidebar's contents for Settings: one group per band, one row per page. */
export function buildSettingsSidebar(
  bands: readonly { section: string; sections: readonly string[] }[],
  active: string,
  labels: { band: (section: string) => string | null; page: (id: string) => string },
): SettingsSidebar {
  return {
    sections: bands.map((band) => ({ id: band.section, title: labels.band(band.section) })),
    items: bands.flatMap((band) =>
      band.sections.map((id) => ({
        id: SETTINGS_ROW_PREFIX + id,
        title: labels.page(id),
        symbol: SETTINGS_SYMBOLS[id] ?? "circle",
        section: band.section,
        active: id === active,
        gated: false as const,
      })),
    ),
  };
}

/** The same list with the "Show all settings" row under it. */
export function withShowAllRow(sidebar: SettingsSidebar, title: string): SettingsSidebar {
  const section = "settings-more";
  return {
    sections: [...sidebar.sections, { id: section, title: null }],
    items: [
      ...sidebar.items,
      {
        id: SETTINGS_ROW_PREFIX + SETTINGS_SHOW_ALL_ROW,
        title,
        symbol: "ellipsis.circle",
        section,
        active: false,
        gated: false as const,
      },
    ],
  };
}

/** The page a native sidebar row stands for, or null when the row is not a Settings row. */
export function settingsPageOf(rowId: string): string | null {
  return rowId.startsWith(SETTINGS_ROW_PREFIX) ? rowId.slice(SETTINGS_ROW_PREFIX.length) : null;
}

export type PublishedSettingsNav = SettingsSidebar & { select: (page: string) => void };

let current: PublishedSettingsNav | null = null;
const listeners = new Set<() => void>();

/** Called by the Settings page while it is on screen; `null` when it leaves. */
export function publishSettingsNav(next: PublishedSettingsNav | null): void {
  current = next;
  listeners.forEach((listener) => listener());
}

/** For `useSyncExternalStore`. */
export const settingsNavStore = [
  (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  () => current,
  () => null,
] as const;

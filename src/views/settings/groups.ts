import type { SectionId } from "./shared";

export type TopGroup = {
  id: string;
  section: string;
  label: string;
  sub: string;
  children: SectionId[];
};

export const TOP_GROUPS: TopGroup[] = [
  {
    id: "start",
    section: "SETUP",
    label: "Get started",
    sub: "The handful of settings most people set once.",
    children: ["basics"],
  },
  {
    id: "account",
    section: "SETUP",
    label: "Account & sync",
    sub: "Your sign-in, the services that track what you watch, and your relay.",
    children: ["account", "trackers", "relay"],
  },
  {
    id: "watching",
    section: "WATCHING",
    label: "Playback",
    sub: "How video plays, how it looks, and what happens between episodes.",
    children: ["player", "mpv", "shaders", "anime"],
  },
  {
    id: "language",
    section: "LANGUAGE",
    label: "Languages & subtitles",
    sub: "What language Harbor speaks, and how subtitles behave.",
    children: ["language", "subtitles"],
  },
  {
    id: "content",
    section: "CONTENT",
    label: "Sources & library",
    sub: "Where streams come from, how they are filtered, and the metadata behind them.",
    children: ["streaming", "streamFilters", "p2p", "library"],
  },
  {
    id: "plugins",
    section: "PLUGINS",
    label: "Plugins",
    sub: "Small scripts that find streams, manga and books on sites Harbor does not know about, installed from repositories you choose.",
    children: ["plugins"],
  },
  {
    id: "look",
    section: "LOOK & FEEL",
    label: "Appearance",
    sub: "Theme, the player's own layout, artwork, and what Harbor shows on a card.",
    children: ["theme", "playerLayout", "badges", "awardIcons"],
  },
  {
    id: "devices",
    section: "DEVICES",
    label: "Controls & devices",
    sub: "Keyboard, controller, remotes, and the big-screen build.",
    children: ["hotkeys", "controllers", "remotes", "tv", "bigPicture"],
  },
  {
    id: "system",
    section: "SYSTEM",
    label: "System",
    sub: "Storage, automation, and the settings most people never need.",
    children: ["storage", "webhooks", "advanced"],
  },
  {
    id: "help",
    section: "HELP",
    label: "Help & support",
    sub: "Report something broken, or support the project.",
    children: ["bug", "support", "licenses", "icons"],
  },
  {
    id: "updates",
    section: "UPDATES",
    label: "Updates & backup",
    sub: "Install updates, try beta builds, and keep a copy of your setup.",
    children: ["updates"],
  },
];

export function groupForSection(id: SectionId): TopGroup | undefined {
  return TOP_GROUPS.find((g) => g.children.includes(id));
}

/** A heading in the Settings navigation and the pages under it. */
export type SettingsBand = { section: string; sections: SectionId[] };

/** Groups that share a heading, merged in order: the Settings navigation's top level. */
export function settingsBands(): SettingsBand[] {
  const out: SettingsBand[] = [];
  const bySection = new Map<string, SettingsBand>();
  for (const group of TOP_GROUPS) {
    const seen = bySection.get(group.section);
    if (seen) {
      seen.sections.push(...group.children);
      continue;
    }
    const band: SettingsBand = { section: group.section, sections: [...group.children] };
    bySection.set(group.section, band);
    out.push(band);
  }
  return out;
}

export const BAND_LABELS: Record<string, string> = {
  SETUP: "Account & setup",
  WATCHING: "Playback",
  LANGUAGE: "Languages",
  CONTENT: "Sources & library",
  "LOOK & FEEL": "Appearance",
  DEVICES: "Controls & devices",
  SYSTEM: "System",
  HELP: "Help & about",
  PLUGINS: "Plugins",
  UPDATES: "Updates & backup",
};

/**
 * macOS: the pages Settings lists before "Show all settings". The rest run
 * infrastructure, decorate, or tune hardware a Mac does not have, and stay one
 * click away.
 */
export const MAC_MAIN_SECTIONS: readonly SectionId[] = [
  "basics",
  "account",
  "player",
  "language",
  "subtitles",
  "streaming",
  "theme",
  "hotkeys",
  "advanced",
  "updates",
];

/** The heading-less band the main pages sit in. */
export const MAC_MAIN_BAND = "MAIN";

/** What a main page is called on macOS, where it differs from its own name. */
export const MAC_SECTION_LABELS: Partial<Record<SectionId, string>> = {
  basics: "General",
  player: "Playback",
  streaming: "Sources",
  theme: "Appearance",
  hotkeys: "Shortcuts",
};

export function isMacMainSection(id: SectionId): boolean {
  return MAC_MAIN_SECTIONS.includes(id);
}

/** The Settings navigation on macOS: the main pages, then every other page under its own heading. */
export function macSettingsBands(showAll: boolean): SettingsBand[] {
  const main: SettingsBand = { section: MAC_MAIN_BAND, sections: [...MAC_MAIN_SECTIONS] };
  if (!showAll) return [main];
  const rest = settingsBands()
    .map((band) => ({
      section: band.section,
      sections: band.sections.filter((id) => !isMacMainSection(id)),
    }))
    .filter((band) => band.sections.length > 0);
  return [main, ...rest];
}

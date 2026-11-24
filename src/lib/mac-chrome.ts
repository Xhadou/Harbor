import type { OsClass } from "./platform";

// The macOS build always runs inside the system window frame, has a single
// navigation layout and one artwork-led dark look, so these choices are
// decided here instead of by settings.

/** The fixed macOS palette: near-black, so artwork carries the colour. */
export const MAC_COLORS = {
  canvas: "#0b0b0d",
  surface: "#141416",
  elevated: "#1d1d20",
  raised: "#28282c",
  ink: "#f5f5f7",
  inkMuted: "#a1a1a6",
  inkSubtle: "#6e6e73",
  edge: "#48484a",
  accent: "#0a84ff",
  danger: "#ff453a",
} as const;

type MacCoercible = {
  useNativeTitleBar: boolean;
  hybridTitleBar: boolean;
  heroFull?: boolean;
  navCustomization?: { hidden: string[] };
  _macNavTrimV1?: boolean;
  resumeDetailScroll?: boolean;
  _macDetailTopV1?: boolean;
  uiScale?: number;
  theme?: {
    preset: string;
    backgroundImage: string | null;
    fontPair: string;
    customFontId?: string | null;
    customColors: unknown;
  };
};

function pinnedTheme<T extends NonNullable<MacCoercible["theme"]>>(theme: T): T {
  if (
    theme.preset === "custom" &&
    theme.customColors === MAC_COLORS &&
    theme.backgroundImage === null &&
    theme.fontPair === "system"
  ) {
    return theme;
  }
  return {
    ...theme,
    preset: "custom",
    backgroundImage: null,
    fontPair: "system",
    customFontId: null,
    customColors: MAC_COLORS,
  };
}

/** Destinations the Mac sidebar starts without. Hidden once; Settings can bring any back. */
export const MAC_NAV_TRIM: readonly string[] = ["music", "games", "manga", "ebook"];

export function coerceMacSettings<T extends MacCoercible>(settings: T, os: OsClass): T {
  if (os !== "macos") return settings;
  const wantsFullHero = "heroFull" in settings && settings.heroFull !== true;
  const theme = settings.theme ? pinnedTheme(settings.theme) : undefined;
  const nav = settings._macNavTrimV1 ? undefined : settings.navCustomization;
  // A title page opens at its top. Off once; the switch in Settings turns
  // "reopen where I left it" back on and the flag keeps it on.
  const opensAtTop = !settings._macDetailTopV1 && "resumeDetailScroll" in settings;
  // The Mac app has no interface zoom: rows size themselves to the window instead
  // (`macRowFit`), so a scale saved by an earlier build is put back to 100%.
  const zoomed = "uiScale" in settings && settings.uiScale !== 1;
  if (
    settings.useNativeTitleBar &&
    !settings.hybridTitleBar &&
    !wantsFullHero &&
    theme === settings.theme &&
    !nav &&
    !opensAtTop &&
    !zoomed
  ) {
    return settings;
  }
  return {
    ...settings,
    useNativeTitleBar: true,
    hybridTitleBar: false,
    ...(wantsFullHero ? { heroFull: true } : null),
    ...(opensAtTop ? { resumeDetailScroll: false, _macDetailTopV1: true } : null),
    ...(zoomed ? { uiScale: 1 } : null),
    ...(theme ? { theme } : null),
    // The flag travels with the saved settings, so a destination the owner turns
    // back on afterwards is not hidden again.
    ...(nav
      ? {
          navCustomization: {
            ...nav,
            hidden: [...nav.hidden, ...MAC_NAV_TRIM.filter((id) => !nav.hidden.includes(id))],
          },
          _macNavTrimV1: true,
        }
      : null),
  };
}

export function macLayout<L extends string>(layout: L, os: OsClass): L | "sidebar" {
  return os === "macos" ? "sidebar" : layout;
}

// Harbor's "borderless" fullscreen works by removing window decorations, which
// would throw away the system frame. macOS has real full screen instead.
export function macFullscreenMode<M extends string>(mode: M, os: OsClass): M | "fullscreen" {
  return os === "macos" && mode === "borderless" ? "fullscreen" : mode;
}

// Harbor's shortcuts were written for Ctrl. The ones a Mac user reaches for
// with Command get a Command default here; a shortcut the user rebound keeps
// their choice. Player shortcuts on Ctrl+digit stay: Command+digit belongs to
// the Go menu, and Command+H hides the app.
export const MAC_DEFAULT_BINDINGS: Readonly<Record<string, string>> = {
  globalSettingsOpen: "meta+,",
  playerScreenLock: "meta+l",
};

/**
 * Shortcuts that do nothing on a Mac and are not listed there: it has no interface zoom, and
 * RTX Video is a feature of NVIDIA's Windows driver.
 */
export const MAC_ABSENT_HOTKEYS: ReadonlySet<string> = new Set([
  "globalUiScaleUp",
  "globalUiScaleDown",
  "globalUiScaleReset",
  "playerRtxHdrToggle",
  "playerRtxVsrToggle",
]);

/** Settings, by the label Settings search knows them by, that the Mac app does not offer. */
export const MAC_ABSENT_SETTINGS: ReadonlySet<string> = new Set([
  "Interface scale",
  "Interface scale (accessibility)",
  // Closing the window always leaves the Mac app running (`mac_native::window_close`).
  "Close to the system tray",
  "System tray",
  // A profile's song plays through the music section, which the Mac edition is built without.
  "Profile songs",
  // A Mac has no taskbar for a separate player window to cover.
  "Cover the taskbar",
  // Only one service names songs on a Mac, so there is nothing to choose.
  "Song ID provider (AudD / Gemini)",
  "Gemini · in-player song ID",
  // The Mac edition is built without the eBook reader.
  "Create folders for eBooks",
  // A Mac's title bar and its buttons are the system's.
  "Window title bar",
  "Top-right controls",
  "Frost the top bar on scroll",
  // The Mac sidebar is the system's own and draws its own icons.
  "Animated sidebar icons",
]);

export function macDefaultBinding(id: string, binding: string, os: OsClass): string {
  return os === "macos" && Object.hasOwn(MAC_DEFAULT_BINDINGS, id)
    ? MAC_DEFAULT_BINDINGS[id]
    : binding;
}

const MAC_KEY_SYMBOLS: Readonly<Record<string, string>> = {
  ctrl: "\u2303",
  alt: "\u2325",
  shift: "\u21E7",
  meta: "\u2318",
  Escape: "esc",
  Enter: "\u21A9",
  Backspace: "\u232B",
  Tab: "\u21E5",
};

/** A binding the way a Mac writes it: modifier symbols first, no plus signs. */
export function macBindingLabel(parts: readonly string[]): string {
  const order = ["ctrl", "alt", "shift", "meta"];
  const mods = order.filter((mod) => parts.slice(0, -1).includes(mod));
  const key = parts[parts.length - 1] ?? "";
  return mods.map((mod) => MAC_KEY_SYMBOLS[mod]).join("") + (MAC_KEY_SYMBOLS[key] ?? key);
}

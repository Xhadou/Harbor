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
  if (
    settings.useNativeTitleBar &&
    !settings.hybridTitleBar &&
    !wantsFullHero &&
    theme === settings.theme &&
    !nav &&
    !opensAtTop
  ) {
    return settings;
  }
  return {
    ...settings,
    useNativeTitleBar: true,
    hybridTitleBar: false,
    ...(wantsFullHero ? { heroFull: true } : null),
    ...(opensAtTop ? { resumeDetailScroll: false, _macDetailTopV1: true } : null),
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
  globalUiScaleUp: "meta+=",
  globalUiScaleDown: "meta+-",
  globalUiScaleReset: "meta+0",
  playerScreenLock: "meta+l",
};

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

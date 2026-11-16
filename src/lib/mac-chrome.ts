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

export function coerceMacSettings<T extends MacCoercible>(settings: T, os: OsClass): T {
  if (os !== "macos") return settings;
  const wantsFullHero = "heroFull" in settings && settings.heroFull !== true;
  const theme = settings.theme ? pinnedTheme(settings.theme) : undefined;
  if (
    settings.useNativeTitleBar &&
    !settings.hybridTitleBar &&
    !wantsFullHero &&
    theme === settings.theme
  ) {
    return settings;
  }
  return {
    ...settings,
    useNativeTitleBar: true,
    hybridTitleBar: false,
    ...(wantsFullHero ? { heroFull: true } : null),
    ...(theme ? { theme } : null),
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

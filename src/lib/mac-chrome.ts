import type { OsClass } from "./platform";

// The macOS build always runs inside the system window frame and has a single
// navigation layout, so both choices are decided here instead of by settings.

export function coerceMacSettings<
  T extends { useNativeTitleBar: boolean; hybridTitleBar: boolean },
>(settings: T, os: OsClass): T {
  if (os !== "macos") return settings;
  if (settings.useNativeTitleBar && !settings.hybridTitleBar) return settings;
  return { ...settings, useNativeTitleBar: true, hybridTitleBar: false };
}

export function macLayout<L extends string>(layout: L, os: OsClass): L | "sidebar" {
  return os === "macos" ? "sidebar" : layout;
}

// Harbor's "borderless" fullscreen works by removing window decorations, which
// would throw away the system frame. macOS has real full screen instead.
export function macFullscreenMode<M extends string>(mode: M, os: OsClass): M | "fullscreen" {
  return os === "macos" && mode === "borderless" ? "fullscreen" : mode;
}

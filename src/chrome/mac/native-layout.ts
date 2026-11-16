import type { NativeLayout } from "./native-events";

/** Gap between the floating sidebar and the content beside it, both sides. */
const SIDEBAR_GUTTER = 16;

/**
 * CSS lengths the web layout uses to stay clear of native chrome. Swift
 * reports screen points; Harbor's interface scale zooms the page, so a CSS
 * pixel is `scale` points wide and the lengths have to be divided by it.
 */
export function layoutInsets(
  layout: NativeLayout,
  scale = 1,
): { titlebar: string; sidebar: string } {
  const zoom = scale > 0 ? scale : 1;
  const css = (points: number) => `${Math.round((points / zoom) * 100) / 100}px`;
  return {
    titlebar: css(layout.titlebarInset),
    sidebar: layout.sidebarVisible ? css(layout.sidebarWidth + SIDEBAR_GUTTER) : "0px",
  };
}

let lastLayout: NativeLayout | null = null;
let interfaceScale = 1;

function write(): void {
  if (!lastLayout) return;
  const insets = layoutInsets(lastLayout, interfaceScale);
  const style = document.documentElement.style;
  style.setProperty("--mac-titlebar-inset", insets.titlebar);
  style.setProperty("--mac-sidebar-inset", insets.sidebar);
}

export function applyNativeLayout(layout: NativeLayout): void {
  lastLayout = layout;
  write();
}

/** Call whenever Harbor's interface scale setting changes. */
export function setNativeLayoutScale(scale: number): void {
  interfaceScale = scale;
  write();
}

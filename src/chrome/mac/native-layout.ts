import type { NativeLayout } from "./native-events";

/** Gap between the floating sidebar and the content beside it, both sides. */
const SIDEBAR_GUTTER = 16;

/** CSS lengths the web layout uses to stay clear of native chrome. */
export function layoutInsets(layout: NativeLayout): { titlebar: string; sidebar: string } {
  return {
    titlebar: `${layout.titlebarInset}px`,
    sidebar: layout.sidebarVisible ? `${layout.sidebarWidth + SIDEBAR_GUTTER}px` : "0px",
  };
}

export function applyNativeLayout(layout: NativeLayout): void {
  const insets = layoutInsets(layout);
  const style = document.documentElement.style;
  style.setProperty("--mac-titlebar-inset", insets.titlebar);
  style.setProperty("--mac-sidebar-inset", insets.sidebar);
}

import type { View } from "@/lib/view";

// What each item of the macOS menu bar (src-tauri/src/mac_native/menu.rs) does.

export type MenuCommand =
  | { kind: "view"; view: View }
  | { kind: "back" }
  | { kind: "toggle-sidebar" }
  | { kind: "find" };

const VIEWS: Record<string, View> = {
  settings: "settings",
  "go-home": "home",
  "go-discover": "discover",
  "go-movies": "movies",
  "go-shows": "shows",
  "go-library": "library",
};

export function menuCommand(action: string): MenuCommand | null {
  if (action === "back") return { kind: "back" };
  if (action === "toggle-sidebar") return { kind: "toggle-sidebar" };
  if (action === "find") return { kind: "find" };
  const view = Object.hasOwn(VIEWS, action) ? VIEWS[action] : undefined;
  return view ? { kind: "view", view } : null;
}

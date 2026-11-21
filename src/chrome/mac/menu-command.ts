import type { View } from "@/lib/view";

// What each item of the macOS menu bar (src-tauri/src/mac_native/menu.rs) does.

export type MenuCommand =
  | { kind: "view"; view: View }
  | { kind: "back" }
  | { kind: "cycle-section"; step: 1 | -1 }
  | { kind: "toggle-sidebar" }
  | { kind: "find" }
  | { kind: "reload" }
  | { kind: "watch-together" };

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
  if (action === "next-section") return { kind: "cycle-section", step: 1 };
  if (action === "previous-section") return { kind: "cycle-section", step: -1 };
  if (action === "toggle-sidebar") return { kind: "toggle-sidebar" };
  if (action === "find") return { kind: "find" };
  if (action === "reload") return { kind: "reload" };
  if (action === "watch-together") return { kind: "watch-together" };
  const view = Object.hasOwn(VIEWS, action) ? VIEWS[action] : undefined;
  return view ? { kind: "view", view } : null;
}

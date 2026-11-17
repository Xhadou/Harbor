import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { subscribe } from "./native-subscription";

// Events from the HarborNative Swift package, re-emitted by Rust
// (src-tauri/src/mac_native/mod.rs) as `mac-native://<kind>`.

export type NativeSearchKey = "ArrowUp" | "ArrowDown" | "Enter" | "Escape";

export type NativeLayout = {
  titlebarInset: number;
  sidebarWidth: number;
  sidebarVisible: boolean;
  /** Where a control in the top-left corner can start, clear of the traffic lights. */
  controlsInset: number;
};

export type NativeEventPayloads = {
  "sidebar-select": { id: string };
  "sidebar-account": Record<string, never>;
  "toolbar-back": Record<string, never>;
  "toolbar-toggle-sidebar": Record<string, never>;
  "search-text": { text: string };
  "search-begin": Record<string, never>;
  "search-end": Record<string, never>;
  "search-key": { key: NativeSearchKey; shift: boolean };
  layout: NativeLayout;
  menu: { action: string };
};

export type NativeEventKind = keyof NativeEventPayloads;

/**
 * Listens for one kind of native event. `onReady` runs once the listener is
 * registered; see `subscribe` for why a request for state has to wait for it.
 */
export function onNativeEvent<K extends NativeEventKind>(
  kind: K,
  handler: (payload: NativeEventPayloads[K]) => void,
  onReady?: () => void,
): () => void {
  return subscribe<NativeEventPayloads[K]>(
    (deliver) => listen<NativeEventPayloads[K]>(`mac-native://${kind}`, (e) => deliver(e.payload)),
    handler,
    onReady,
  );
}

export type NativeStateCommand =
  | "mac_native_sidebar_set"
  | "mac_native_toolbar_set"
  | "mac_native_search_set";

export function pushNativeState(command: NativeStateCommand, payload: unknown): void {
  pushNativeJson(command, JSON.stringify(payload));
}

export function pushNativeJson(command: NativeStateCommand, json: string): void {
  void invoke(command, { payload: json }).catch((e) =>
    console.warn(`[harbor] ${command} failed`, e),
  );
}

/** DOM event carrying keys the native search field hands to the web results. */
export const NATIVE_SEARCH_KEY_EVENT = "harbor:native-search-key";
export type NativeSearchKeyDetail = NativeEventPayloads["search-key"];

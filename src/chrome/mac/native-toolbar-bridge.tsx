import { useEffect, useRef, useSyncExternalStore } from "react";
import { setWindowFullscreen } from "@/lib/fullscreen-state";
import { findHotkeyMatch, shouldHandleGlobalKeyboardEvent } from "@/lib/hotkeys";
import { useActiveKid } from "@/lib/profiles";
import { useSearchActions, useSearchData, useSearchOpen } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { nativeChromeCoverStore } from "./native-chrome-cover";
import { NATIVE_SEARCH_KEY_EVENT, onNativeEvent, pushNativeState } from "./native-events";
import { applyNativeLayout, setNativeLayoutScale } from "./native-layout";
import { setNativeSearchParts, useNativeSearchActive } from "./native-search-state";
import { NativeTextEcho } from "./native-text-echo";
import { searchHiddenFor, toolbarPayload } from "./toolbar-payload";

/**
 * Keeps the native macOS window controls (Back, the sidebar toggle and the
 * sidebar's search field) and Harbor's own state in step. Harbor stays the
 * source of truth: the controls are told what to show and report what the
 * user did.
 */
export function NativeToolbarBridge({
  playerActive,
  immersive,
}: {
  playerActive: boolean;
  immersive: boolean;
}) {
  const { canGoBack, goBack, view, topKind, chromeHidden } = useView();
  const kid = useActiveKid();
  const { setOpen, setQuery } = useSearchActions();
  const open = useSearchOpen();
  const { query } = useSearchData();
  const { settings } = useSettings();
  const hotkeys = settings.hotkeys;
  const covered = useSyncExternalStore(...nativeChromeCoverStore);

  const { visible, searchVisible } = toolbarPayload({
    playerActive,
    immersive: immersive || chromeHidden || covered,
    canGoBack,
    searchHidden: searchHiddenFor({ view, topKind, connecting: false, kid: !!kid }),
  });

  const toolbarState = useRef({ visible, canGoBack, searchVisible });
  useEffect(() => {
    toolbarState.current = { visible, canGoBack, searchVisible };
    pushNativeState("mac_native_toolbar_set", toolbarState.current);
    setNativeSearchParts({ allowed: searchVisible });
  }, [visible, canGoBack, searchVisible]);
  useEffect(() => () => setNativeSearchParts({ allowed: false }), []);
  const nativeSearch = useNativeSearchActive();
  useEffect(() => {
    setNativeLayoutScale(settings.uiScale);
  }, [settings.uiScale]);

  // What the native field has typed, so its own text is not sent back to it.
  const echo = useRef(new NativeTextEcho());
  const nativeFocused = useRef(false);
  const actions = useRef({ goBack, setOpen, setQuery });
  useEffect(() => {
    actions.current = { goBack, setOpen, setQuery };
  }, [goBack, setOpen, setQuery]);

  useEffect(() => {
    const stops = [
      // Swift answers a toolbar update with its layout. The first update goes
      // out before this listener exists, so ask again once it does; otherwise
      // the page can start with no insets and sit under the sidebar.
      onNativeEvent("layout", applyNativeLayout, () =>
        pushNativeState("mac_native_toolbar_set", toolbarState.current),
      ),
      // The green button, the View menu and Mission Control change full screen
      // without asking Harbor. The window reports every change, so Harbor's
      // own flag follows the window instead of guessing.
      onNativeEvent("fullscreen", ({ on }) => setWindowFullscreen(on)),
      onNativeEvent("toolbar-back", () => {
        actions.current.setOpen(false);
        actions.current.goBack();
      }),
      onNativeEvent("search-begin", () => {
        nativeFocused.current = true;
        actions.current.setOpen(true);
      }),
      // Leaving the field does not close search: clicking a result also takes
      // focus away. Search closes through Escape or the overlay itself.
      onNativeEvent("search-end", () => {
        nativeFocused.current = false;
      }),
      onNativeEvent("search-text", ({ text }) => {
        echo.current.reported(text);
        actions.current.setQuery(text);
      }),
      onNativeEvent("search-key", (detail) => {
        window.dispatchEvent(new CustomEvent(NATIVE_SEARCH_KEY_EVENT, { detail }));
      }),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, []);

  useEffect(() => {
    if (!echo.current.shouldSend(query)) return;
    pushNativeState("mac_native_search_set", { text: query });
  }, [query]);

  useEffect(() => {
    if (!open) {
      pushNativeState("mac_native_search_set", { focused: false });
    } else if (nativeSearch && !nativeFocused.current) {
      pushNativeState("mac_native_search_set", { focused: true });
    }
  }, [open, nativeSearch]);

  // The search hotkey used to live in the web search pill, which macOS no
  // longer renders.
  useEffect(() => {
    if (!searchVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (!shouldHandleGlobalKeyboardEvent(e)) return;
      if (findHotkeyMatch(e, hotkeys ?? {}, "Global") !== "globalSearchFocus") return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys, setOpen, searchVisible]);

  return null;
}

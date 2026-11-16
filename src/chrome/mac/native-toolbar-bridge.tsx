import { useEffect, useRef } from "react";
import { findHotkeyMatch, shouldHandleGlobalKeyboardEvent } from "@/lib/hotkeys";
import { useActiveKid } from "@/lib/profiles";
import { useSearchActions, useSearchData, useSearchOpen } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { NATIVE_SEARCH_KEY_EVENT, onNativeEvent, pushNativeState } from "./native-events";
import { applyNativeLayout } from "./native-layout";
import { setNativeSearchParts, useNativeSearchActive } from "./native-search-state";
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

  const { visible, searchVisible } = toolbarPayload({
    playerActive,
    immersive: immersive || chromeHidden,
    canGoBack,
    searchHidden: searchHiddenFor({ view, topKind, connecting: false, kid: !!kid }),
  });

  useEffect(() => {
    pushNativeState("mac_native_toolbar_set", { visible, canGoBack, searchVisible });
    setNativeSearchParts({ allowed: searchVisible });
  }, [visible, canGoBack, searchVisible]);
  useEffect(() => () => setNativeSearchParts({ allowed: false }), []);
  const nativeSearch = useNativeSearchActive();

  // Text and focus as the native field last reported them, to avoid echoing
  // its own changes back to it.
  const nativeText = useRef("");
  const nativeFocused = useRef(false);
  const actions = useRef({ goBack, setOpen, setQuery });
  useEffect(() => {
    actions.current = { goBack, setOpen, setQuery };
  }, [goBack, setOpen, setQuery]);

  useEffect(() => {
    const stops = [
      onNativeEvent("layout", applyNativeLayout),
      onNativeEvent("toolbar-back", () => actions.current.goBack()),
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
        nativeText.current = text;
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
    if (query === nativeText.current) return;
    nativeText.current = query;
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

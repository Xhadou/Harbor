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
import { settingsSearchStore } from "./settings-sidebar";
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

  // Non-null while Settings is on screen with the sidebar shown: the field then searches Settings.
  const settingsSearch = useSyncExternalStore(...settingsSearchStore);
  const searchesSettings = settingsSearch !== null;

  const { visible, searchVisible: globalSearch } = toolbarPayload({
    playerActive,
    immersive: immersive || chromeHidden || covered,
    canGoBack,
    searchHidden: searchHiddenFor({ view, topKind, connecting: false, kid: !!kid }),
  });
  // The field is on screen for either search; `globalSearch` alone says the
  // catalogue search is on offer.
  const searchVisible = globalSearch || (visible && searchesSettings);

  const toolbarState = useRef({ visible, canGoBack, searchVisible });
  useEffect(() => {
    toolbarState.current = { visible, canGoBack, searchVisible };
    pushNativeState("mac_native_toolbar_set", toolbarState.current);
    setNativeSearchParts({ allowed: globalSearch });
  }, [visible, canGoBack, searchVisible, globalSearch]);
  useEffect(() => () => setNativeSearchParts({ allowed: false }), []);
  const nativeSearch = useNativeSearchActive();
  useEffect(() => {
    setNativeLayoutScale(settings.uiScale);
  }, [settings.uiScale]);

  // What the native field has typed, so its own text is not sent back to it.
  const echo = useRef(new NativeTextEcho());
  const nativeFocused = useRef(false);
  const actions = useRef({ goBack, setOpen, setQuery, settingsSearch });
  useEffect(() => {
    actions.current = { goBack, setOpen, setQuery, settingsSearch };
  }, [goBack, setOpen, setQuery, settingsSearch]);

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
        if (!actions.current.settingsSearch) actions.current.setOpen(true);
      }),
      // Leaving the field does not close search: clicking a result also takes
      // focus away. Search closes through Escape or the overlay itself.
      onNativeEvent("search-end", () => {
        nativeFocused.current = false;
      }),
      onNativeEvent("search-text", ({ text }) => {
        echo.current.reported(text);
        const settingsTarget = actions.current.settingsSearch;
        if (settingsTarget) settingsTarget.setQuery(text);
        else actions.current.setQuery(text);
      }),
      onNativeEvent("search-key", (detail) => {
        const settingsTarget = actions.current.settingsSearch;
        if (settingsTarget) settingsTarget.key(detail.key);
        else window.dispatchEvent(new CustomEvent(NATIVE_SEARCH_KEY_EVENT, { detail }));
      }),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, []);

  // The field shows the text of whichever search it is serving.
  const fieldText = settingsSearch ? settingsSearch.query : query;
  const servedSettings = useRef(searchesSettings);
  useEffect(() => {
    if (servedSettings.current !== searchesSettings) {
      // The field changed hands: what it holds belongs to the other search.
      servedSettings.current = searchesSettings;
      echo.current = new NativeTextEcho();
    }
    if (!echo.current.shouldSend(fieldText)) return;
    pushNativeState("mac_native_search_set", { text: fieldText });
  }, [fieldText, searchesSettings]);

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
      if (searchesSettings) pushNativeState("mac_native_search_set", { focused: true });
      else setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys, setOpen, searchVisible, searchesSettings]);

  return null;
}

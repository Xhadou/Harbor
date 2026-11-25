import { SoftDiv } from "@/components/soft-swap";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  buildSettingsResults,
  buildSettingsSidebar,
  publishSettingsNav,
  publishSettingsSearch,
  SETTINGS_SHOW_ALL_ROW,
  settingsResultOf,
  withShowAllRow,
  type SettingsSidebar,
} from "@/chrome/mac/settings-sidebar";
import { pushNativeState } from "@/chrome/mac/native-events";
import { findHotkeyMatch, shouldHandleGlobalKeyboardEvent } from "@/lib/hotkeys";
import { useT } from "@/lib/i18n";
import { isMacDesktop } from "@/lib/platform";
import { useSettings } from "@/lib/settings";
import {
  BAND_LABELS,
  isMacMainSection,
  MAC_MAIN_BAND,
  MAC_SECTION_LABELS,
  macSettingsBands,
} from "./groups";
import { useNavSearch } from "./nav";
import { settingsAnchor, type SectionId } from "./shared";
import type { SubTabReg } from "./sub-tabs";

/** How many matching settings the sidebar lists under the matching pages. */
const MAX_OPTION_RESULTS = 12;

/** Whether the native sidebar, and so its search field, is on screen. */
export function useMacSidebarSearch(): boolean {
  const { settings } = useSettings();
  return isMacDesktop() && !settings.sidebarCollapsed;
}

const SHOW_ALL_KEY = "harbor.mac.settings.showAll";

function readShowAll(): boolean {
  try {
    return localStorage.getItem(SHOW_ALL_KEY) === "1";
  } catch {
    return false;
  }
}

function writeShowAll(on: boolean): void {
  try {
    if (on) localStorage.setItem(SHOW_ALL_KEY, "1");
    else localStorage.removeItem(SHOW_ALL_KEY);
  } catch {
    // The choice then lasts until Settings is closed.
  }
}

/** A Settings page's name: on macOS the main pages carry shorter names. */
export function settingsPageLabel(id: SectionId, own: string): string {
  return (isMacDesktop() && MAC_SECTION_LABELS[id]) || own;
}

/**
 * On macOS the Settings pages are listed in the native sidebar, the way System
 * Settings lists its panes. This hands them over while Settings is on screen
 * and takes the clicks back. Renders nothing.
 *
 * The list starts with the main pages and a "Show all settings" row. A page
 * outside them that is opened another way (a link, the search field) brings
 * the full list with it, so the open page is always in the list.
 *
 * The sidebar's search field searches Settings while this is on screen: the
 * list then shows the matching pages and settings, and Return opens the first.
 * The search key goes to that field too (or to Settings' own field when the
 * sidebar is hidden), not to the catalogue search, and Escape leaves it.
 */
export function MacSettingsNav({
  visible,
  active,
  meta,
  query,
  setQuery,
  onSelect,
  onJump,
  fieldRef,
}: {
  visible: boolean;
  active: SectionId;
  meta: Record<SectionId, { label: string; sub: string }>;
  query: string;
  setQuery: (text: string) => void;
  onSelect: (section: SectionId) => void;
  onJump: (section: SectionId, anchor?: string, tab?: string) => void;
  /** Settings' own search field, shown when the sidebar is not. */
  fieldRef: RefObject<HTMLInputElement | null>;
}) {
  const t = useT();
  const mac = isMacDesktop();
  const { settings } = useSettings();
  const hotkeys = settings.hotkeys;
  const sidebarSearch = useMacSidebarSearch();
  const [showAll, setShowAll] = useState(readShowAll);
  const all = showAll || !isMacMainSection(active);

  const searching = mac && visible && sidebarSearch && query.trim() !== "";
  const { matches, optionMatches } = useNavSearch(searching ? query.trim().toLowerCase() : "");
  const results = [
    ...(matches ?? []).map((item) => ({
      page: item.id as string,
      title: t(settingsPageLabel(item.id, item.label)),
      open: () => onJump(item.id),
    })),
    ...(optionMatches ?? []).slice(0, MAX_OPTION_RESULTS).map((option) => ({
      page: option.section as string,
      title: t(option.label),
      open: () =>
        onJump(
          option.section,
          option.anchorTitle ? settingsAnchor(option.anchorTitle) : undefined,
          option.tab,
        ),
    })),
  ];
  const pageCount = matches?.length ?? 0;

  const select = useRef<(page: string) => void>(() => {});
  select.current = (page) => {
    const result = settingsResultOf(page);
    if (result !== null) {
      results[result]?.open();
      setQuery("");
      return;
    }
    if (page !== SETTINGS_SHOW_ALL_ROW) return onSelect(page as SectionId);
    writeShowAll(!all);
    setShowAll(!all);
    // Hiding the other pages while one of them is open would bring them straight back.
    if (all && !isMacMainSection(active)) onSelect("basics");
  };

  const searchKey = useRef<(key: string) => void>(() => {});
  searchKey.current = (pressed) => {
    if (pressed === "Escape") {
      setQuery("");
      pushNativeState("mac_native_search_set", { focused: false });
    } else if (pressed === "Enter" && results.length > 0) select.current("result:0");
  };

  // Taken before the window's own listeners (the catalogue search's) hear the key at all.
  useEffect(() => {
    if (!mac || !visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (!shouldHandleGlobalKeyboardEvent(event)) return;
      if (findHotkeyMatch(event, hotkeys ?? {}, "Global") !== "globalSearchFocus") return;
      // A dialog over Settings keeps its keys.
      if (document.querySelector('[role="dialog"]')) return;
      const field = sidebarSearch ? null : fieldRef.current;
      if (!sidebarSearch && !field) return;
      event.preventDefault();
      event.stopPropagation();
      if (field) field.focus();
      else pushNativeState("mac_native_search_set", { focused: true });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mac, visible, sidebarSearch, hotkeys, fieldRef]);
  const setQueryRef = useRef(setQuery);
  setQueryRef.current = setQuery;
  const offered = mac && visible && sidebarSearch;
  useEffect(() => {
    if (!offered) return;
    publishSettingsSearch({
      query,
      setQuery: (text) => setQueryRef.current(text),
      key: (pressed) => searchKey.current(pressed),
    });
  }, [offered, query]);
  useEffect(() => {
    if (!offered) return;
    return () => {
      publishSettingsSearch(null);
      // The field goes back to the catalogue search; a half-typed Settings query should not linger.
      setQueryRef.current("");
    };
  }, [offered]);

  const key = !(mac && visible)
    ? ""
    : JSON.stringify(
        searching
          ? buildSettingsResults(results.slice(0, pageCount), results.slice(pageCount), {
              pages: t("Pages"),
              options: t("Settings"),
            })
          : withShowAllRow(
              buildSettingsSidebar(macSettingsBands(all), active, {
                band: (section) =>
                  section === MAC_MAIN_BAND ? null : t(BAND_LABELS[section] ?? section),
                page: (id) => t(settingsPageLabel(id as SectionId, meta[id as SectionId].label)),
              }),
              all ? t("Show fewer settings") : t("Show all settings"),
            ),
      );
  useEffect(() => {
    if (!mac) return;
    publishSettingsNav(
      key
        ? {
            ...(JSON.parse(key) as SettingsSidebar),
            select: (page) => select.current(page),
          }
        : null,
    );
  }, [mac, key]);
  useEffect(
    () => () => {
      if (mac) publishSettingsNav(null);
    },
    [mac],
  );
  return null;
}

/**
 * The tabs of the page that is open, as a strip above its content. Other
 * platforms list them in the Settings sidebar; on macOS that sidebar is the
 * native one and holds pages only.
 */
export function MacSettingsTabs({ reg }: { reg: SubTabReg }) {
  const t = useT();
  if (!isMacDesktop() || !reg || reg.tabs.length < 2) return null;
  return (
    <SoftDiv data-arrives="" className="hset-mac-tabs" role="tablist" aria-label={t("Sections")}>
      {reg.tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === reg.value}
          className="hset-mac-tab"
          onClick={() => reg.onChange(tab.id)}
        >
          {t(tab.label)}
          {tab.dot && <span className="hset-mac-tab-dot" aria-hidden />}
        </button>
      ))}
    </SoftDiv>
  );
}

/**
 * Changing tab swaps the content inside a page that stays mounted, so the
 * page-change cascade never runs for it. This replays the same short rise on
 * the element the returned ref is attached to. macOS only.
 */
export function useMacTabEnter(reg: SubTabReg) {
  const panel = useRef<HTMLDivElement>(null);
  const section = reg?.section;
  const value = reg?.value;
  const last = useRef({ section, value });
  useLayoutEffect(() => {
    const was = last.current;
    last.current = { section, value };
    // A different page already cascades in; a tab appearing for the first time is not a change.
    if (was.section !== section || was.value === undefined || was.value === value) return;
    if (!isMacDesktop() || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    panel.current?.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }, [section, value]);
  return panel;
}

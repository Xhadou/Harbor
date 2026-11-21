import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  buildSettingsSidebar,
  publishSettingsNav,
  SETTINGS_SHOW_ALL_ROW,
  withShowAllRow,
  type SettingsSidebar,
} from "@/chrome/mac/settings-sidebar";
import { useT } from "@/lib/i18n";
import { isMacDesktop } from "@/lib/platform";
import {
  BAND_LABELS,
  isMacMainSection,
  MAC_MAIN_BAND,
  MAC_SECTION_LABELS,
  macSettingsBands,
} from "./groups";
import type { SectionId } from "./shared";
import type { SubTabReg } from "./sub-tabs";

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
 */
export function MacSettingsNav({
  visible,
  active,
  meta,
  onSelect,
}: {
  visible: boolean;
  active: SectionId;
  meta: Record<SectionId, { label: string; sub: string }>;
  onSelect: (section: SectionId) => void;
}) {
  const t = useT();
  const mac = isMacDesktop();
  const [showAll, setShowAll] = useState(readShowAll);
  const all = showAll || !isMacMainSection(active);
  const select = useRef<(page: string) => void>(() => {});
  select.current = (page) => {
    if (page !== SETTINGS_SHOW_ALL_ROW) return onSelect(page as SectionId);
    writeShowAll(!all);
    setShowAll(!all);
    // Hiding the other pages while one of them is open would bring them straight back.
    if (all && !isMacMainSection(active)) onSelect("basics");
  };
  const key =
    mac && visible
      ? JSON.stringify(
          withShowAllRow(
            buildSettingsSidebar(macSettingsBands(all), active, {
              band: (section) =>
                section === MAC_MAIN_BAND ? null : t(BAND_LABELS[section] ?? section),
              page: (id) => t(settingsPageLabel(id as SectionId, meta[id as SectionId].label)),
            }),
            all ? t("Show fewer settings") : t("Show all settings"),
          ),
        )
      : "";
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
    <div className="hset-mac-tabs" role="tablist" aria-label={t("Sections")}>
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
    </div>
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

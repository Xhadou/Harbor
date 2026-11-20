import { useEffect, useLayoutEffect, useRef } from "react";
import {
  buildSettingsSidebar,
  publishSettingsNav,
  type SettingsSidebar,
} from "@/chrome/mac/settings-sidebar";
import { useT } from "@/lib/i18n";
import { isMacDesktop } from "@/lib/platform";
import { BAND_LABELS, settingsBands } from "./groups";
import type { SectionId } from "./shared";
import type { SubTabReg } from "./sub-tabs";

/**
 * On macOS the Settings pages are listed in the native sidebar, the way System
 * Settings lists its panes. This hands them over while Settings is on screen
 * and takes the clicks back. Renders nothing.
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
  const select = useRef(onSelect);
  select.current = onSelect;
  const key =
    mac && visible
      ? JSON.stringify(
          buildSettingsSidebar(settingsBands(), active, {
            band: (section) => t(BAND_LABELS[section] ?? section),
            page: (id) => t(meta[id as SectionId].label),
          }),
        )
      : "";
  useEffect(() => {
    if (!mac) return;
    publishSettingsNav(
      key
        ? {
            ...(JSON.parse(key) as SettingsSidebar),
            select: (page) => select.current(page as SectionId),
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

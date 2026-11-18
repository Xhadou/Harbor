import { useEffect, useRef } from "react";
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

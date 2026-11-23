import { HAS_EBOOK, HAS_GAMES, HAS_MANGA, HAS_MUSIC } from "@/lib/features/edition";
import { useT } from "@/lib/i18n";
import { MAC_NAV_TRIM } from "@/lib/mac-chrome";
import { isMacDesktop } from "@/lib/platform";
import { useSettings } from "@/lib/settings";
import { Section, ToggleRow } from "./shared";

const LABELS: Record<string, string> = {
  music: "nav.music",
  games: "nav.games",
  manga: "nav.manga",
  ebook: "nav.ebook",
};

/** A place this build does not carry cannot be brought back, so it is not offered. */
const CARRIED: Record<string, boolean> = {
  music: HAS_MUSIC,
  games: HAS_GAMES,
  manga: HAS_MANGA,
  ebook: HAS_EBOOK,
};

/**
 * macOS: the destinations the sidebar starts without, each with a switch to
 * bring it back. Other platforms edit the sidebar from its own context menu,
 * which the native Mac sidebar does not have.
 */
export function MacSidebarSection() {
  const t = useT();
  const { settings, update } = useSettings();
  if (!isMacDesktop()) return null;
  const places = MAC_NAV_TRIM.filter((id) => CARRIED[id] !== false);
  if (places.length === 0) return null;
  const nav = settings.navCustomization;
  return (
    <Section title={t("Sidebar")} subtitle={t("More places you can keep in the sidebar.")}>
      {places.map((id) => (
        <ToggleRow
          key={id}
          label={t(LABELS[id] ?? id)}
          value={!nav.hidden.includes(id)}
          onChange={(on) =>
            update({
              navCustomization: {
                ...nav,
                hidden: on ? nav.hidden.filter((entry) => entry !== id) : [...nav.hidden, id],
              },
            })
          }
        />
      ))}
    </Section>
  );
}

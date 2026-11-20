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

/**
 * macOS: the destinations the sidebar starts without, each with a switch to
 * bring it back. Other platforms edit the sidebar from its own context menu,
 * which the native Mac sidebar does not have.
 */
export function MacSidebarSection() {
  const t = useT();
  const { settings, update } = useSettings();
  if (!isMacDesktop()) return null;
  const nav = settings.navCustomization;
  return (
    <Section title={t("Sidebar")} subtitle={t("More places you can keep in the sidebar.")}>
      {MAC_NAV_TRIM.map((id) => (
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

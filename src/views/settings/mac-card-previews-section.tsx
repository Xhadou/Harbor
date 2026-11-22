import { useT } from "@/lib/i18n";
import { isMacDesktop } from "@/lib/platform";
import { useSettings } from "@/lib/settings";
import { SettingGroup } from "./kit";
import { Section, ToggleRow } from "./shared";

/** macOS: whether a card opens into its preview when the pointer rests on it. */
export function MacCardPreviewsSection() {
  const t = useT();
  const { settings, update } = useSettings();
  if (!isMacDesktop()) return null;
  return (
    <Section title={t("Card previews")}>
      <SettingGroup>
        <ToggleRow
          label={t("Play previews on cards")}
          sub={t(
            "Rest the pointer on a card and it opens sideways to play the trailer, with Play beside it. Off: cards stay as they are.",
          )}
          value={settings.cardPreviews}
          onChange={(cardPreviews) => update({ cardPreviews })}
        />
      </SettingGroup>
    </Section>
  );
}

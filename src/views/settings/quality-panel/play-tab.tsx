import { useT } from "@/lib/i18n";
import { isMacDesktop } from "@/lib/platform";
import { PlayModePanel } from "../player-panel";
import { ROW_DESC, Section } from "../shared";

export function PlayTab() {
  const t = useT();
  return (
    <Section title={t("Play button behavior")} bare>
      <div className="flex flex-col gap-[11px]">
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {isMacDesktop()
            ? t(
                "Choose what happens when you press Play on a title. Pick a source gives you full control over quality and source.",
              )
            : t(
                "Choose what happens when you hit Play on a title. Manual gives you full control over quality and source.",
              )}
        </p>
        <PlayModePanel />
      </div>
    </Section>
  );
}

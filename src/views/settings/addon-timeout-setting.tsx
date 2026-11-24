import { useId } from "react";
import { useT } from "@/lib/i18n";
import { isMacDesktop } from "@/lib/platform";
import { useSettings } from "@/lib/settings";
import { SettingRow } from "./kit";
import { Section } from "./shared";

const CHOICES = [15, 30, 45, 60, 90] as const;

export function AddonTimeoutSetting() {
  const t = useT();
  const id = useId();
  const { settings, update } = useSettings();
  const raw = settings.addonTimeoutSec ?? 30;
  const current = Number.isFinite(raw) ? Math.max(8, Math.min(120, raw)) : 30;
  const choices = [...new Set<number>([...CHOICES, current])].sort((a, b) => a - b);
  const what = t("How long Harbor waits for each addon to return results.");
  const note = t(
    "Results appear as they arrive. Increase the wait time if an addon often needs a refresh before its results appear.",
  );
  // On macOS the note is the rest of the row's description. Under the row it stood a
  // row's padding away from the line it finishes.
  const mac = isMacDesktop();

  return (
    <Section title={t("Addon wait time")}>
      <SettingRow label={t("Addon wait time")} desc={mac ? `${what} ${note}` : what}>
        <select
          id={id}
          aria-label={t("Addon wait time")}
          value={current}
          onChange={(event) => update({ addonTimeoutSec: Number(event.target.value) })}
          className="h-11 min-w-[190px] rounded-[8px] border border-edge-soft bg-elevated px-3 text-[15px] text-ink"
        >
          {choices.map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds === 30 ? t("30 seconds (default)") : t("{seconds} seconds", { seconds })}
            </option>
          ))}
        </select>
      </SettingRow>
      {!mac && <p className="max-w-[68ch] text-[15px] leading-[22px] text-ink-muted">{note}</p>}
    </Section>
  );
}

import { useMemo } from "react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";

export type MacSetupSummary = {
  /** Who is signed in, or null. */
  account: string | null;
  sourceCount: number;
};

export function DoneStep({ mac }: { mac?: MacSetupSummary }) {
  const { settings } = useSettings();
  const t = useT();
  const enabled = useMemo(
    () => Object.values(settings.streaming).filter(Boolean).length,
    [settings.streaming],
  );
  if (mac) {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <DoneCheck />
        <div className="flex flex-col gap-2">
          <h1 className="mac-type-title text-ink">{t("You're set.")}</h1>
          <p className="mac-type-lead text-balance text-ink-muted">
            {mac.account
              ? t("Signed in as {name}.", { name: mac.account })
              : t("Not signed in. You can sign in from Settings.")}
            <br />
            {mac.sourceCount === 0
              ? t("No streaming source yet. Harbor will ask for one the first time you press Play.")
              : mac.sourceCount === 1
                ? t("One streaming source is ready.")
                : t("{n} streaming sources are ready.", { n: mac.sourceCount })}
          </p>
          <p className="mac-type-small text-ink-subtle">
            {t("Subtitle languages, streaming services and the TMDB key are in Settings.")}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-6 pt-4 text-center">
      <DoneCheck />

      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[40px] font-medium leading-[1.05] tracking-tight text-ink">
          {t("You're set.")}
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-muted">
          {settings.tmdbKey
            ? t("TMDB connected. {n} streaming {services} on. Welcome aboard.", {
                n: enabled,
                services: t(enabled === 1 ? "service" : "services"),
              })
            : t("Running on Cinemeta for now. Add a TMDB key from Settings whenever you're ready.")}
        </p>
      </div>
    </div>
  );
}

function DoneCheck() {
  return (
    <div className="animate-done-pop">
      <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
        <circle
          cx="42"
          cy="42"
          r="36"
          stroke="oklch(0.78 0.17 145)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          className="animate-done-ring"
          transform="rotate(-90 42 42)"
        />
        <path
          d="M27 43 L37.5 53.5 L57 33"
          stroke="oklch(0.82 0.18 145)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="animate-done-check"
        />
      </svg>
    </div>
  );
}

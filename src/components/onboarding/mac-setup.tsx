import { useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/components/modal-shell";
import { DoneStep } from "@/components/onboarding/done-step";
import { Dots } from "@/components/onboarding/dots";
import { LanguageStep } from "@/components/onboarding/language-step";
import { StremioStep } from "@/components/onboarding/stremio-step";
import { StreamSourceSetup } from "@/components/stream-source-setup";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { loadSavedStep, saveStep, setupForward, setupSteps } from "@/lib/setup-steps";
import { declaresStream } from "@/lib/streams/addon-priority";
import { useView } from "@/lib/view";
import { useAddons } from "@/views/play-picker/use-addons";

const STEPS = setupSteps(true);
const TITLE_ID = "mac-setup-source-title";

/**
 * Setup on macOS: four steps in one card that never changes size, with one
 * forward button per step.
 */
export function MacSetup({ onFinish }: { onFinish: () => void }) {
  const t = useT();
  const { user, authKey } = useAuth();
  const { settings } = useSettings();
  const { setView } = useView();
  const { addons } = useAddons(authKey, settings);
  const sources = useMemo(() => addons?.filter(declaresStream) ?? null, [addons]);
  const [idx, setIdx] = useState(() => loadSavedStep(STEPS));
  const [closing, setClosing] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  useFocusTrap(card);

  const step = STEPS[idx]!;
  useEffect(() => saveStep(step), [step]);

  const forward = setupForward(step, {
    signedIn: !!user,
    sourceCount: sources === null ? null : sources.length,
  });
  const finish = () => {
    saveStep(null);
    setClosing(true);
    window.setTimeout(onFinish, 320);
  };
  const next = () => setIdx((i) => Math.min(i + 1, STEPS.length - 1));

  return (
    <div
      // One above the page header (z-55), whose buttons would otherwise stay
      // bright and clickable over the dimmed page.
      className={`fixed inset-0 z-[56] flex items-center justify-center bg-canvas/85 backdrop-blur-md ${
        closing ? "opacity-0 transition-opacity duration-300" : "animate-fade-in"
      }`}
    >
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={t("Set up Harbor")}
        className="mac-dialog mac-setup-card flex flex-col overflow-hidden"
      >
        <div className="mac-setup-body flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div key={step} className={`animate-step-in ${step === "done" ? "my-auto" : ""}`}>
            {step === "language" && <LanguageStep />}
            {step === "stremio" && <StremioStep />}
            {step === "source" && (
              <StreamSourceSetup
                titleId={TITLE_ID}
                sources={sources}
                signedIn={!!user}
                onBrowse={() => {
                  finish();
                  setView("addons");
                }}
              />
            )}
            {step === "done" && (
              <DoneStep
                mac={{
                  account: user ? user.fullname || user.email : null,
                  sourceCount: sources?.length ?? 0,
                }}
              />
            )}
          </div>
        </div>

        <div className="mac-setup-foot flex shrink-0 items-center justify-between">
          <Dots count={STEPS.length} active={idx} onJump={setIdx} />
          <div className="flex items-center gap-2">
            {idx > 0 && (
              <button
                onClick={() => setIdx((i) => Math.max(i - 1, 0))}
                className="mac-btn mac-btn-lg mac-btn-quiet flex"
              >
                {t("Back")}
              </button>
            )}
            <button
              // One button that changes its reading, not two that swap places:
              // the key keeps focus on it when a step becomes ready.
              key="forward"
              onClick={forward === "finish" ? finish : next}
              className={`mac-btn mac-btn-lg flex ${
                forward === "skip" ? "mac-btn-secondary" : "mac-btn-main"
              }`}
            >
              {forward === "finish"
                ? t("Enter Harbor")
                : forward === "skip"
                  ? t("Skip")
                  : t("Continue")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

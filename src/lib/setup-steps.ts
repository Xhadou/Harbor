export type SetupStepId =
  | "splash"
  | "language"
  | "welcome"
  | "layout"
  | "tmdb"
  | "stremio"
  | "streaming"
  | "subtitles"
  | "taste"
  | "source"
  | "done";

const FULL_STEPS: SetupStepId[] = [
  "splash",
  "language",
  "welcome",
  "layout",
  "tmdb",
  "stremio",
  "streaming",
  "subtitles",
  "taste",
  "done",
];

// macOS asks only for what a first run needs: a language, an account, and
// something to play from. Everything else the full setup asks is in Settings.
const MAC_STEPS: SetupStepId[] = ["language", "stremio", "source", "done"];

export function setupSteps(mac: boolean): SetupStepId[] {
  return mac ? MAC_STEPS : FULL_STEPS;
}

export type SetupProgress = {
  signedIn: boolean;
  /** Streaming sources found so far; null while they are still being read. */
  sourceCount: number | null;
};

export type SetupForward = "continue" | "skip" | "finish";

/**
 * A macOS step has one forward button. It reads "Continue" once the step has
 * what it asks for and "Skip" until then, so the two never sit side by side.
 */
export function setupForward(step: SetupStepId, progress: SetupProgress): SetupForward {
  if (step === "done") return "finish";
  if (step === "stremio") return progress.signedIn ? "continue" : "skip";
  if (step === "source") return (progress.sourceCount ?? 0) > 0 ? "continue" : "skip";
  return "continue";
}

const STEP_KEY = "harbor.setup.step";

/** Where setup was before a reload, so a reload does not start it over. */
export function readSavedStep(steps: SetupStepId[], raw: string | null): number {
  const idx = raw === null ? -1 : steps.indexOf(raw as SetupStepId);
  return idx < 0 ? 0 : idx;
}

export function loadSavedStep(steps: SetupStepId[]): number {
  try {
    return readSavedStep(steps, sessionStorage.getItem(STEP_KEY));
  } catch {
    return 0;
  }
}

export function saveStep(step: SetupStepId | null): void {
  try {
    if (step === null) sessionStorage.removeItem(STEP_KEY);
    else sessionStorage.setItem(STEP_KEY, step);
  } catch {
    /* a reload starts setup over, nothing else is lost */
  }
}

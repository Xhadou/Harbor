import { flushSync } from "react-dom";
import { isMacDesktop } from "./platform";

/**
 * Page changes on macOS cross-fade: the page being left stays on screen as a
 * picture until the new one is laid out, then one fades into the other.
 *
 * A plain entrance animation cannot do this. It starts its clock when the page
 * becomes current, and a large page then spends most of the fade inside its
 * own first frame; measured in the Mac window, Home came back already 60 to
 * 78% opaque in the first frame drawn, which reads as a cut.
 *
 * The web view takes the "before" picture one frame after it is asked, so the
 * state change is held for that frame. Changes that arrive while one is held
 * wait behind it, in order.
 */

type Commit = () => void;

/**
 * One element of the page being left that the web view draws turning into one
 * element of the new page, instead of fading each on its own.
 */
export type CarriedPicture = {
  /** Before the picture of the page being left is taken: names what is carried. */
  leave: () => void;
  /** Once the new page is laid out: names what it becomes, if anything. */
  arrive: () => void;
  /** When the change is over, however it ended. */
  done: () => void;
};

type Batch = { commits: Commit[]; ran: boolean };
let held: Batch | null = null;

function canTransition(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    isMacDesktop() &&
    // A window that is not being drawn takes no pictures; its change must not wait for one.
    document.visibilityState === "visible" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Whether page changes cross-fade here at all (the engine supports it, on macOS). */
export function pageTransitionsSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    isMacDesktop()
  );
}

/** Resolves once the page now in front has something laid out, or after a short wait. */
async function frontPageLaidOut(): Promise<void> {
  const started = performance.now();
  for (;;) {
    const roots = [...document.querySelectorAll(".harbor-layer-active")].flatMap((layer) => [
      ...layer.children,
    ]);
    if (roots.some((el) => el.getBoundingClientRect().height > 100)) return;
    if (performance.now() - started > 350) return;
    // Not requestAnimationFrame: frames are not produced while the picture is held.
    await new Promise((resolve) => window.setTimeout(resolve, 16));
  }
}

/**
 * Applies a navigation state change, cross-fading when it changes the page.
 *
 * `eligible`: the page being left can be pictured (not the player, not the
 * picker). `changedPage` is asked after the change has rendered and says
 * whether a different page is now in front; when it is not, nothing animates.
 * `carried` is only used by a change that starts its own cross-fade.
 */
export function commitWithPageTransition(
  commit: Commit,
  eligible: boolean,
  changedPage: () => boolean,
  carried?: CarriedPicture,
): void {
  if (held && !held.ran) {
    held.commits.push(commit);
    return;
  }
  if (!eligible || !canTransition()) {
    commit();
    return;
  }
  const batch: Batch = { commits: [commit], ran: false };
  held = batch;
  const run = () => {
    if (batch.ran) return false;
    batch.ran = true;
    if (held === batch) held = null;
    flushSync(() => {
      for (const each of batch.commits) each();
    });
    return true;
  };
  // If the picture never comes (the window went behind another), go without it.
  const withoutPicture = window.setTimeout(run, 250);
  try {
    carried?.leave();
    const transition = document.startViewTransition(async () => {
      window.clearTimeout(withoutPicture);
      if (!run() || !changedPage()) {
        transition.skipTransition();
        return;
      }
      await frontPageLaidOut();
      carried?.arrive();
    });
    // A skipped transition rejects these; that is not an error here.
    transition.ready.catch(() => {});
    const over = () => carried?.done();
    transition.finished.then(over, over);
    transition.updateCallbackDone.catch(() => {});
  } catch {
    window.clearTimeout(withoutPicture);
    carried?.done();
    run();
  }
}

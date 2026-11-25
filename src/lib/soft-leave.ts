import { useLayoutEffect, type RefObject } from "react";
import { isChangingPage } from "./page-transition";
import { isMacDesktop } from "./platform";

/**
 * An exit for a thing that is unmounted the moment it is no longer wanted
 * (macOS). A component cannot fade what it has stopped rendering, so the fade
 * is done on a copy: taken while the real element is still in the page, put
 * exactly where it was, and removed when it has faded. The page under it is
 * already in its new state, so what replaces the element is seen arriving
 * through the copy, as a cross-fade.
 *
 * It is opted into by name, one component at a time, through `useLeaveSoftly`.
 * The entrance that goes with it is the `data-arrives` attribute (index.css).
 */

const LEAVE_MS = 160;
/** Above this many elements inside it, a part is let go without a copy. */
const MOST_PARTS = 2500;
/** Unmounted this soon after mounting, it was never really shown (React's check of effects in development does this). */
const NEVER_SHOWN_MS = 80;
/**
 * Inside `[data-leave="through"]` the copy goes quickly, and what replaces it
 * waits for it (index.css). Two pages of text in one place, one fading over
 * the other, read as neither: Settings swaps whole pages and tabs this way.
 */
const THROUGH_MS = 90;

/**
 * The parts copied in the current commit, each with its copy. A part inside
 * another that leaves at the same moment is already in that one's copy; a
 * second copy of it would draw it twice.
 */
const leftNow = new Map<HTMLElement, HTMLElement>();

/**
 * Whether this is the Mac app. An unmount can come where there is no app to ask
 * (a test's page, a window being torn down), and an exit must never throw.
 */
function onMac(): boolean {
  try {
    return typeof window !== "undefined" && isMacDesktop();
  } catch {
    return false;
  }
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A place for the copy that looks, to every style rule, like where the real
 * element sat, and that nothing can move: an empty copy of each element above
 * it, none of them drawn as a box (`display: contents`), at the end of the
 * page's body.
 *
 * The copy cannot simply go beside the real element. Its place is fixed
 * against the window, and an element above that starts to move (Settings
 * slides a tab's body in with a transform) becomes what fixed things are
 * placed against, throwing the copy off by that element's own position; and
 * an element above that is itself being removed takes the copy with it.
 */
function standIn(parent: Element): { outer: HTMLElement; inner: HTMLElement } {
  let inner: HTMLElement | null = null;
  let outer: HTMLElement | null = null;
  for (
    let node: Element | null = parent;
    node && node !== document.body && node !== document.documentElement;
    node = node.parentElement
  ) {
    const shell = node.cloneNode(false) as HTMLElement;
    shell.removeAttribute("id");
    shell.setAttribute("data-ghost", "around");
    shell.style.display = "contents";
    shell.style.removeProperty("view-transition-name");
    if (outer) shell.append(outer);
    else inner = shell;
    outer = shell;
  }
  if (!inner || !outer) {
    const shell = document.createElement("div");
    shell.setAttribute("data-ghost", "around");
    shell.style.display = "contents";
    return { outer: shell, inner: shell };
  }
  outer.setAttribute("aria-hidden", "true");
  outer.setAttribute("inert", "");
  return { outer, inner };
}

/**
 * Leaves a fading copy of `el` where it is. Call it while `el` is still in the
 * page, just before it is removed.
 */
export function leaveSoftly(el: HTMLElement, ms: number = LEAVE_MS): void {
  if (!onMac() || reducedMotion() || isChangingPage()) return;
  const parent = el.parentElement;
  if (!parent || !el.isConnected) return;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return;
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
    return;
  }
  const opacity = Number(getComputedStyle(el).opacity);
  if (!(opacity > 0.05)) return;
  // A copy of a very large part costs more than the fade is worth; what replaces it still fades in.
  if (el.getElementsByTagName("*").length > MOST_PARTS) return;
  for (const left of leftNow.keys()) if (left.contains(el)) return;
  const through = el.closest('[data-leave="through"]') !== null;
  const duration = through ? Math.min(ms, THROUGH_MS) : ms;

  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.setAttribute("data-ghost", "copy");
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  ghost.removeAttribute("id");
  ghost.removeAttribute("data-arrives");
  for (const withId of ghost.querySelectorAll("[id]")) withId.removeAttribute("id");
  // Out of the flow and pinned to where the real one is, so what takes its place is laid out under it.
  Object.assign(ghost.style, {
    position: "fixed",
    inset: "auto",
    left: "0px",
    top: "0px",
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: "0",
    transform: "none",
    animation: "none",
    transition: "none",
    pointerEvents: "none",
    overflow: "hidden",
  });
  const home = standIn(parent);
  home.inner.append(ghost);
  document.body.append(home.outer);
  // Where "0, 0" and "this wide" really come out is only known once it is in the page: the
  // interface scale multiplies every length. Measure that once and solve for the real place.
  const origin = ghost.getBoundingClientRect();
  const scale = origin.width > 0 ? origin.width / r.width : 1;
  ghost.style.left = `${(r.left - origin.left) / scale}px`;
  ghost.style.top = `${(r.top - origin.top) / scale}px`;
  ghost.style.width = `${r.width / scale}px`;
  ghost.style.height = `${r.height / scale}px`;
  // A long part scrolled inside its page shows the same slice it showed.
  ghost.scrollTop = el.scrollTop;
  const gone = () => home.outer.remove();
  // React lets go of a part before the parts inside it, but a copy made the other way round is
  // replaced all the same.
  for (const [left, copy] of leftNow) {
    if (el.contains(left)) {
      copy.remove();
      leftNow.delete(left);
    }
  }
  if (leftNow.size === 0) queueMicrotask(() => leftNow.clear());
  leftNow.set(el, home.outer);
  ghost
    .animate([{ opacity }, { opacity: 0 }], {
      duration,
      // Gone fast enough that what waits for it is never drawn under much of it.
      easing: through ? "ease-out" : "ease-in",
      fill: "forwards",
    })
    .finished.then(gone, gone);
}

/**
 * Gives the element in `ref` a soft exit: when the component that renders it
 * unmounts, a fading copy is left in its place. It has to be an unmount: by
 * the time a component that merely re-renders hears of it, its element
 * already shows the new contents. Contents that are swapped in place go in a
 * `SoftSwap` (components/soft-swap.tsx), which unmounts the old ones.
 */
export function useLeaveSoftly(ref: RefObject<HTMLElement | null>, ms: number = LEAVE_MS): void {
  useLayoutEffect(() => {
    const born = performance.now();
    const el = ref.current;
    return () => {
      if (el && performance.now() - born > NEVER_SHOWN_MS) leaveSoftly(el, ms);
    };
  }, [ref, ms]);
}

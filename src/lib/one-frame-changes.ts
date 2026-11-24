import { isMacDesktop } from "./platform";

/**
 * On macOS nothing arrives or leaves in one frame.
 *
 * Most of the interface is drawn by components that mount a thing when it is
 * wanted and unmount it when it is not: a menu, the content that replaces a
 * loading placeholder, the next tab's rows. Unless the component gave it an
 * entrance or an exit of its own, it is there in one frame and gone in one.
 * An audit of the Mac edition found that in dozens of places, most of them in
 * screens this fork inherited; going through them one component at a time
 * would leave the next one unhandled. So this watches the page instead:
 *
 * - a part of the page in front that arrives with no motion of its own fades in;
 * - a menu or popover that is removed leaves a copy of itself behind for the
 *   length of a short fade, since the real one is already gone.
 *
 * Whatever already animates is left alone, as is anything during a change of
 * page (page-transition.ts covers that) and anything inside a card or a row,
 * which come and go as rows scroll. `data-no-arrive` opts a part out.
 */

const ARRIVE_MS = 220;
const LEAVE_MS = 150;
/** A part smaller than this arriving is a detail, not a change of the page. */
const MIN_WIDTH = 160;
const MIN_HEIGHT = 28;
/** More than this many places changing at once is a page being built, not a change to one. */
const MOST_AT_ONCE = 10;
/** This many arriving in one place are that place's new contents: the place fades in, once, not each of them. */
const MANY_IN_ONE_PLACE = 4;
/** The same part arriving again this soon is being redrawn, and fading it each time would flicker. */
const AGAIN_MS = 1200;

/** Menus and popovers: drawn over the page, removed when dismissed. */
const POPUPS =
  ".mac-menu, .context-menu-position, .harbor-profile-dropdown, [data-dropdown-menu], [role='menu'], [role='tooltip']";
/** Never faded in: cards and what is inside them, and anything that says so. */
const NOT_ARRIVALS =
  "[data-media-card], .mac-cw-root, [data-no-arrive], [data-ghost], video, canvas";
/** Set on the root by page-transition.ts while one page is becoming another. */
export const PAGE_CHANGING = "data-page-changing";

let watching = false;
const arrivedAt = new Map<string, number>();

function signature(el: HTMLElement): string {
  return `${el.tagName}.${el.className?.toString?.() ?? ""}`.slice(0, 160);
}

/** Whether it, something around it or something directly inside it is already in motion. */
function alreadyMoving(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el, depth = 0; node && depth < 5; depth++) {
    if (node.getAnimations().length > 0) return true;
    node = node.parentElement;
  }
  for (const child of el.children) if (child.getAnimations().length > 0) return true;
  return false;
}

function arrive(el: HTMLElement): void {
  const popup = el.matches(POPUPS);
  if (!popup && !el.closest(".harbor-layer-active")) return;
  if (el.closest(NOT_ARRIVALS)) return;
  const r = el.getBoundingClientRect();
  if (r.width < (popup ? 40 : MIN_WIDTH) || r.height < (popup ? 24 : MIN_HEIGHT)) return;
  if (r.bottom < 0 || r.top > window.innerHeight) return;
  if (alreadyMoving(el)) return;
  const key = signature(el);
  const now = performance.now();
  const before = arrivedAt.get(key);
  arrivedAt.set(key, now);
  if (before !== undefined && now - before < AGAIN_MS) return;
  el.animate(
    popup
      ? [
          { opacity: 0, transform: "scale(0.98)" },
          { opacity: 1, transform: "none" },
        ]
      : [{ opacity: 0 }, { opacity: 1 }],
    { duration: popup ? LEAVE_MS : ARRIVE_MS, easing: "ease-out" },
  );
}

/** Puts a copy of a removed popup back where it was and fades the copy out. */
function leave(el: HTMLElement, parent: Node, before: Node | null): void {
  // A menu drawn in a container of its own loses the container in the same breath; the page's body does as well.
  const home = parent instanceof Element && parent.isConnected ? parent : document.body;
  const ghost = el.cloneNode(true) as HTMLElement;
  ghost.setAttribute("data-ghost", "");
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  ghost.removeAttribute("id");
  for (const withId of ghost.querySelectorAll("[id]")) withId.removeAttribute("id");
  ghost.style.pointerEvents = "none";
  home.insertBefore(ghost, before?.parentNode === home ? before : null);
  const position = getComputedStyle(ghost).position;
  const r = ghost.getBoundingClientRect();
  // In the flow of the page a copy would push what follows it; only what floats over the page is left behind.
  if ((position !== "fixed" && position !== "absolute") || r.width < 8 || r.height < 8) {
    ghost.remove();
    return;
  }
  const gone = () => ghost.remove();
  ghost
    .animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "scale(0.98)" },
      ],
      { duration: LEAVE_MS, easing: "ease-in", fill: "forwards" },
    )
    .finished.then(gone, gone);
}

/** Starts watching the page. Called once, on macOS. */
export function watchOneFrameChanges(): void {
  if (watching || typeof document === "undefined" || !isMacDesktop()) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  watching = true;
  const root = document.documentElement;
  new MutationObserver((records) => {
    if (root.hasAttribute(PAGE_CHANGING)) return;
    const arrivals: HTMLElement[] = [];
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (!(node instanceof HTMLElement) || node.hasAttribute("data-ghost")) continue;
        if (node.matches(POPUPS) || node.querySelector(POPUPS)) {
          leave(node, record.target, record.nextSibling);
        }
      }
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && !node.hasAttribute("data-ghost")) arrivals.push(node);
      }
    }
    if (arrivals.length === 0) return;
    const places = new Map<HTMLElement | null, HTMLElement[]>();
    for (const el of arrivals) {
      if (!el.isConnected) continue;
      const together = places.get(el.parentElement);
      if (together) together.push(el);
      else places.set(el.parentElement, [el]);
    }
    if (places.size > MOST_AT_ONCE) return;
    for (const [place, together] of places) {
      if (place && together.length >= MANY_IN_ONE_PLACE) arrive(place);
      else for (const el of together) arrive(el);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

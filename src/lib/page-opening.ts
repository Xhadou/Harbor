import type { CarriedPicture } from "./page-transition";
import { isMacDesktop } from "./platform";

/**
 * On macOS a page opens out of the thing that was pressed to open it and, on
 * the way back, closes into it. One frame changes shape between the card and
 * the window; inside it the card's picture and the page dissolve into each
 * other while both stay their own proportions. Back is the same frame going
 * the other way, landing on the card's exact shape.
 *
 * The web view does the drawing (see page-transition.ts): the pressed picture
 * and the whole web page (`#root`, always the size of the window) share one
 * view-transition name for the length of the page change, so they arrive as
 * the two pictures of one frame.
 *
 * Every step of the motion is worked out here, up front, as scale, position
 * and opacity only, and handed to the styles as keyframes. The web view's own way of reshaping a frame changes its
 * width and height each frame, which waits on the page's work; a title page is
 * still loading while it opens, and that motion stuttered. A frame that is
 * scaled, with each picture inside scaled the opposite way to stay undistorted,
 * does not wait on anything. The opposite of a scale that is itself easing is
 * not a straight line between two values, which is why the steps are written
 * out one by one.
 *
 * Nothing here knows which component drew the thing pressed or which page it
 * opens. The press is read from the document, so a poster, a collection card,
 * a Top 10 card, a Continue Watching card, a streaming service's tile and the
 * hero all work the same way. A page opened by anything else (the sidebar, a
 * search result, the keyboard with nothing pressed) keeps the plain cross-fade.
 */

const NAME = "mac-page-open";
/** Set on the root while the motion runs; the styles hang off it. */
const ACTIVE_CLASS = "mac-open-vt";
/** Beside it, which way the motion runs: "open" out of a card, "close" back into it. */
const DIRECTION = "data-open-vt";
/** A press older than this did not cause the page change now being made. */
const PRESS_FRESH_MS = 1200;

const OPEN_MS = 700;
const CLOSE_MS = 700;
/** The frame's travel: away promptly, then a long settle into place. */
const TRAVEL: Bezier = [0.32, 0, 0.12, 1];
/** How many steps the motion is written out in. */
const STEPS = 40;

/** What a page can open out of. `data-opens-page` is for anything with no class or mark of its own. */
const ORIGIN =
  "[data-media-card], .mac-cw-root, .harbor-service-tile, .harbor-hero-stage, [data-opens-page]";
/** The part of it that is the picture, where it is not the whole thing. */
const ORIGIN_PICTURE = "[data-preview-anchor], [data-continue-card-trigger]";
/** Of those, the ones a page has only one of. A hero redraws itself, so the one pressed may be gone on the way back. */
const ORIGIN_ONLY_ONE = ".harbor-hero-stage";
/** The whole web page: always the window's size, and it does not scroll. */
const PAGE = "#root";
/**
 * A page's top section, where it has one: the picture across its top with its
 * title. `data-page-top` is for a page whose top section is not a hero.
 */
const PAGE_TOP = "[data-tv-hero-zone], [data-page-top]";

/** What the styles read, set on the root. */
const SET_ON_ROOT = [
  "--mac-open-w",
  "--mac-open-h",
  "--mac-open-card-w",
  "--mac-open-card-h",
  "--mac-open-ms",
] as const;
/** The style element that holds one motion's steps while it runs. */
const STEPS_ID = "mac-open-steps";

type Bezier = [number, number, number, number];
type Box = { left: number; top: number; width: number; height: number };
type Plan = { direction: "open" | "close"; card: Box; page: Box };
type Step = { offset: number; transform: string; opacity?: number };

type Origin = { picture: WeakRef<HTMLElement>; again: string | null };

let pressed: { picture: HTMLElement; again: string | null; at: number } | null = null;
let watching = false;
let marked: HTMLElement | null = null;
/** What each open page came out of, by the page's key. */
const openedFrom = new Map<string, Origin>();

/** Starts noting what was pressed. Called once at start, so the first press counts too. */
export function watchOpeningPresses(): void {
  if (watching || typeof document === "undefined" || !isMacDesktop()) return;
  watching = true;
  document.addEventListener(
    "click",
    (event) => {
      const origin = (event.target as Element | null)?.closest?.<HTMLElement>(ORIGIN);
      if (!origin) return;
      pressed = {
        picture: origin.querySelector<HTMLElement>(ORIGIN_PICTURE) ?? origin,
        again: origin.matches(ORIGIN_ONLY_ONE) ? ORIGIN_ONLY_ONE : null,
        at: performance.now(),
      };
    },
    true,
  );
}

function mark(el: HTMLElement): void {
  unmark();
  el.style.setProperty("view-transition-name", NAME);
  marked = el;
}

function unmark(): void {
  marked?.style.removeProperty("view-transition-name");
  marked = null;
}

/**
 * Drawn, and with enough of it inside the window to grow from or shrink into.
 * A page kept in the background still has boxes, so being seen is asked too:
 * without that, going on from a title page to its source picker closed the
 * title page into its card on the Home page behind, which nobody could see.
 */
function onScreen(el: HTMLElement): boolean {
  if (!el.isConnected || el.getClientRects().length === 0) return false;
  if (!el.checkVisibility({ visibilityProperty: true })) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return false;
  const seenWidth = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  const seenHeight = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  return seenWidth > 0 && seenHeight > 0 && seenWidth * seenHeight >= r.width * r.height * 0.25;
}

/**
 * What a page closes as: its top section where it has one, else the page's own
 * element, and never the whole web page. Taken whole (`#root`, or a title
 * page's scrolling element), the picture brought the way back down to about 15
 * frames a second in the Mac window; a top section or a plain page's element
 * runs at the full 60. A page whose own element holds rows of cards is not
 * plain in that sense: taken whole, a streaming service's page left the web
 * view drawing nothing for 900 ms (its script kept running; with the rows left
 * out of the picture it drew every frame), so such a page marks its top
 * section with `data-page-top`. A top section scrolled out of sight, or a page
 * far taller than the window, has nothing to close from and cross-fades as any
 * other page does.
 */
function closingPicture(): HTMLElement | null {
  // Only the page in front: a page kept in the background still has boxes.
  const drawn = (el: HTMLElement) =>
    el.getClientRects().length > 0 && el.checkVisibility({ visibilityProperty: true });
  const tops = [
    ...document.querySelectorAll<HTMLElement>(`.harbor-layer-active ${PAGE_TOP}`),
  ].filter(drawn);
  const top = tops[tops.length - 1];
  if (top) return onScreen(top) ? top : null;
  let page: HTMLElement | null = null;
  let largest = 0;
  for (const layer of document.querySelectorAll(".harbor-layer-active")) {
    for (const child of layer.children) {
      if (!(child instanceof HTMLElement) || !drawn(child)) continue;
      const r = child.getBoundingClientRect();
      if (r.width * r.height > largest) {
        page = child;
        largest = r.width * r.height;
      }
    }
  }
  if (!page || !onScreen(page)) return null;
  return page.getBoundingClientRect().height <= window.innerHeight * 1.25 ? page : null;
}

/** The thing a page came out of, if it (or the one now standing where it was) can be closed into. */
function originOnScreen(origin: Origin | undefined): HTMLElement | null {
  if (!origin) return null;
  const picture = origin.picture.deref();
  if (picture && onScreen(picture)) return picture;
  if (!origin.again) return null;
  return [...document.querySelectorAll<HTMLElement>(origin.again)].find(onScreen) ?? null;
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** The curve of a cubic-bezier easing, as a function of time from 0 to 1. */
function easing([x1, y1, x2, y2]: Bezier): (x: number) => number {
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const at = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3 - x;
      const slope = 3 * (1 - t) ** 2 * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t ** 2 * (1 - x2);
      if (Math.abs(slope) < 1e-6) break;
      t -= at / slope;
    }
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
  };
}

/** 0 before `from`, 1 after `to`, eased in between. */
function fade(t: number, from: number, to: number): number {
  const x = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return x * x * (3 - 2 * x);
}

/**
 * The three parts' steps. The frame is a box the page's size, scaled and moved
 * to where the frame is; each picture is scaled back by the frame's own scale
 * and up by whatever makes it cover the frame.
 */
function steps(plan: Plan): { frame: Step[]; page: Step[]; card: Step[] } {
  const travel = easing(TRAVEL);
  const opening = plan.direction === "open";
  const [start, end] = opening ? [plan.card, plan.page] : [plan.page, plan.card];
  const frame: Step[] = [];
  const page: Step[] = [];
  const card: Step[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const p = travel(t);
    const at = (a: number, b: number) => a + (b - a) * p;
    const width = at(start.width, end.width);
    const height = at(start.height, end.height);
    const sx = width / plan.page.width;
    const sy = height / plan.page.height;
    const pageCover = Math.max(sx, sy);
    const cardCover = Math.max(width / plan.card.width, height / plan.card.height);
    frame.push({
      offset: t,
      transform: `translate(${at(start.left, end.left)}px, ${at(start.top, end.top)}px) scale(${sx}, ${sy})`,
    });
    // Opening, the page comes in over the card's picture and the picture goes once it is
    // covered. Closing, the card's picture comes in over the page through the middle of
    // the motion, then the page goes from under it.
    page.push({
      offset: t,
      transform: `scale(${pageCover / sx}, ${pageCover / sy})`,
      opacity: opening ? fade(t, 0.03, 0.32) : 1 - fade(t, 0.68, 0.86),
    });
    card.push({
      offset: t,
      transform: `scale(${cardCover / sx}, ${cardCover / sy})`,
      opacity: opening ? 1 - fade(t, 0.26, 0.4) : fade(t, 0.22, 0.72),
    });
  }
  return { frame, page, card };
}

/**
 * Writes the steps out as three sets of keyframes for the styles to run. They
 * are given to the web view as styles and not started from script: motion
 * started from script kept pace with the page's own work in the Mac window
 * (leaving a streaming service's page it showed 11 frames), where the same
 * motion as keyframes carried on through it.
 */
function writeSteps(plan: Plan): void {
  const { frame, page, card } = steps(plan);
  const keyframes = (name: string, list: Step[]) =>
    `@keyframes ${name}{${list
      .map(
        (step) =>
          `${(step.offset * 100).toFixed(2)}%{transform:${step.transform}${
            step.opacity === undefined ? "" : `;opacity:${step.opacity.toFixed(4)}`
          }}`,
      )
      .join("")}}`;
  let sheet = document.getElementById(STEPS_ID);
  if (!sheet) {
    sheet = document.createElement("style");
    sheet.id = STEPS_ID;
    document.head.append(sheet);
  }
  sheet.textContent =
    keyframes("mac-open-frame", frame) +
    keyframes("mac-open-page", page) +
    keyframes("mac-open-card", card);
}

/**
 * The picture carried across one page change: `fromKey` names the page being
 * left, `toKey` is asked once the change has rendered.
 */
export function pageOpening(
  fromKey: string | null,
  toKey: () => string | null,
): CarriedPicture | undefined {
  if (!isMacDesktop()) return undefined;
  let leaving: "card" | "page" | null = null;
  let again: string | null = null;
  /** Where the thing being left was, measured before the page changed under it. */
  let leftAt: Box | null = null;
  let plan: Plan | null = null;
  return {
    leave() {
      const press = pressed;
      pressed = null;
      if (press && performance.now() - press.at < PRESS_FRESH_MS && onScreen(press.picture)) {
        leftAt = boxOf(press.picture);
        again = press.again;
        mark(press.picture);
        leaving = "card";
        return;
      }
      // Only a page that was opened out of something has anything to close into.
      if (!fromKey || !openedFrom.has(fromKey)) return;
      const page = closingPicture();
      if (!page) return;
      leftAt = boxOf(page);
      mark(page);
      leaving = "page";
    },
    arrive() {
      const left = marked;
      unmark();
      const page = document.querySelector<HTMLElement>(PAGE);
      if (!page) return;
      if (leaving === "card") {
        const key = toKey();
        if (!left || !key || !leftAt) return;
        openedFrom.set(key, { picture: new WeakRef(left), again });
        mark(page);
        plan = { direction: "open", card: leftAt, page: boxOf(page) };
      } else if (leaving === "page") {
        const card = originOnScreen(fromKey ? openedFrom.get(fromKey) : undefined);
        if (!card || !leftAt) return;
        mark(card);
        plan = { direction: "close", card: boxOf(card), page: leftAt };
      } else {
        return;
      }
      writeSteps(plan);
      const root = document.documentElement;
      root.style.setProperty(
        "--mac-open-ms",
        `${plan.direction === "open" ? OPEN_MS : CLOSE_MS}ms`,
      );
      root.style.setProperty("--mac-open-w", `${plan.page.width}px`);
      root.style.setProperty("--mac-open-h", `${plan.page.height}px`);
      root.style.setProperty("--mac-open-card-w", `${plan.card.width}px`);
      root.style.setProperty("--mac-open-card-h", `${plan.card.height}px`);
      root.setAttribute(DIRECTION, plan.direction);
      root.classList.add(ACTIVE_CLASS);
    },
    done() {
      unmark();
      leaving = null;
      leftAt = null;
      plan = null;
      const root = document.documentElement;
      root.classList.remove(ACTIVE_CLASS);
      root.removeAttribute(DIRECTION);
      for (const name of SET_ON_ROOT) root.style.removeProperty(name);
      document.getElementById(STEPS_ID)?.remove();
    },
  };
}

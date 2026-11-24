import type { CarriedPicture } from "./page-transition";
import { isMacDesktop } from "./platform";

/**
 * On macOS a title page opens out of the card that was pressed and, on the way
 * back, closes into it. The web view does the growing: the card's picture and
 * the title page's top section are given one shared name for the length of the
 * page change, and it draws one becoming the other (see page-transition.ts).
 *
 * Nothing here knows which component drew the card. The press is read from the
 * document, so a poster, a Continue Watching card and the "More info" of an
 * open preview all work, and a title page opened any other way (the hero, a
 * search result, the keyboard with nothing pressed) keeps the plain cross-fade.
 */

const NAME = "mac-title-open";
/** Set on the root while one picture is becoming the other; the styles slow the cross-fade to match. */
const ACTIVE_CLASS = "mac-title-vt";
/** Beside it, which way the motion runs: "open" out of a card, "close" back into it. */
const DIRECTION = "data-title-vt";
/** A press older than this did not cause the page change now being made. */
const PRESS_FRESH_MS = 1200;
/** A title page scrolled further than this has nothing at its top to close from. */
const HERO_SCROLLED_AWAY_PX = 120;

const CARD = "[data-media-card], .mac-cw-root";
const CARD_PICTURE = "[data-preview-anchor], [data-continue-card-trigger]";
const HERO = "[data-title-hero]";

let pressed: { picture: HTMLElement; at: number } | null = null;
let watching = false;
let marked: HTMLElement | null = null;
/** Which card each open title page came out of, by the page's key. */
const openedFrom = new Map<string, WeakRef<HTMLElement>>();

/** Starts noting which card was pressed. Called once at start, so the first press counts too. */
export function watchCardPresses(): void {
  if (watching || typeof document === "undefined" || !isMacDesktop()) return;
  watching = true;
  document.addEventListener(
    "click",
    (event) => {
      const card = (event.target as Element | null)?.closest?.<HTMLElement>(CARD);
      if (!card) return;
      pressed = {
        picture: card.querySelector<HTMLElement>(CARD_PICTURE) ?? card,
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

/** Drawn, and with enough of it inside the window to grow from or shrink into. */
function onScreen(el: HTMLElement): boolean {
  if (!el.isConnected || el.getClientRects().length === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return false;
  const seenWidth = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  const seenHeight = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  return seenWidth > 0 && seenHeight > 0 && seenWidth * seenHeight >= r.width * r.height * 0.4;
}

function frontHero(): HTMLElement | null {
  const drawn = [...document.querySelectorAll<HTMLElement>(HERO)].filter(
    (el) => el.getClientRects().length > 0,
  );
  return drawn[drawn.length - 1] ?? null;
}

export type TransitionPage = { key: string | null; title: boolean };

/**
 * The picture carried across one page change: `from` is the page being left,
 * `to` is asked once the change has rendered.
 */
export function titlePagePicture(
  from: TransitionPage,
  to: () => TransitionPage,
): CarriedPicture | undefined {
  if (!isMacDesktop()) return undefined;
  let leaving: "card" | "hero" | null = null;
  return {
    leave() {
      const press = pressed;
      pressed = null;
      if (press && performance.now() - press.at < PRESS_FRESH_MS && onScreen(press.picture)) {
        mark(press.picture);
        leaving = "card";
        return;
      }
      if (!from.title) return;
      const hero = frontHero();
      if (hero && hero.getBoundingClientRect().top > -HERO_SCROLLED_AWAY_PX) {
        mark(hero);
        leaving = "hero";
      }
    },
    arrive() {
      const left = marked;
      unmark();
      if (leaving === "card") {
        const now = to();
        const hero = now.title ? frontHero() : null;
        if (!left || !hero || !now.key) return;
        openedFrom.set(now.key, new WeakRef(left));
        mark(hero);
      } else if (leaving === "hero") {
        const card = from.key ? openedFrom.get(from.key)?.deref() : undefined;
        if (!card || !onScreen(card)) return;
        mark(card);
      } else {
        return;
      }
      const root = document.documentElement;
      root.setAttribute(DIRECTION, leaving === "card" ? "open" : "close");
      root.classList.add(ACTIVE_CLASS);
    },
    done() {
      unmark();
      leaving = null;
      const root = document.documentElement;
      root.classList.remove(ACTIVE_CLASS);
      root.removeAttribute(DIRECTION);
    },
  };
}

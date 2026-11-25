import {
  Children,
  createContext,
  isValidElement,
  memo,
  startTransition,
  useCallback,
  useId,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { observeResize, observeWithin } from "@/lib/visibility";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";
import { NavChevron } from "./nav-arrow";
import { useT, useUiLanguage, isRtl as checkRtl } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { MAC_ROW_GAP, macRowFit } from "@/lib/mac-row-fit";
import { isMacDesktop } from "@/lib/platform";
import { useViewActions } from "@/lib/view";
import { resetPosterDock as resetPosterDockItems, updatePosterDock } from "@/lib/poster-dock";
import { scrollDeltaToRevealCard } from "@/lib/poster-backdrop-expansion";
import { flushSync } from "react-dom";
import { RowCardExpansionProvider } from "@/components/row-card-expansion";
import {
  PREVIEW_TRAILER_OUT_MS,
  easeProgress,
  previewMotion,
  type PreviewMotion,
  OPEN_CARD_CLEAR_PX,
  liftRoom,
  liftScale,
  openWidthWithin,
} from "@/lib/card-preview/policy";
import { cardPreviewsOn } from "@/lib/card-preview/store";

const GAP = 20;

function columnSpan(value?: string): number {
  const span = value?.match(/span\s+(\d+)/)?.[1];
  return span ? Math.max(1, Number(span)) : 1;
}
const EAGER_COUNT = 6;
const NEAR_MARGIN = "300px";
const FAR_RELEASE_MS = 15000;

export type RowShape = "portrait" | "landscape" | "service" | "rank" | "tile" | "square" | "cta";

export const TV_CARD_MIN = 318;

function holdsPosterCards(children: React.ReactNode): boolean {
  const first = Children.toArray(children)[0];
  if (!isValidElement(first)) return false;
  const type = first.type as { isPosterCard?: boolean };
  if (!type?.isPosterCard) return false;
  return (first.props as { kids?: boolean; meta?: { type?: string } }).kids !== true;
}

// A pause this long between wheel events starts a new swipe.
const SWIPE_GAP_MS = 120;
// A swipe that has moved a row this far sideways is the row's for good.
const SWIPE_SIDEWAYS_PX = 48;
// How far a swipe that started sideways must go clearly downward, over at least two events
// running, before it is taken to be the page's.
const SWIPE_DOWNWARD_PX = 8;

/** The nearest ancestor that scrolls up and down: the page a row sits in. */
function pageScrollerOf(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

/**
 * macOS: how far a row's scroller may run past the row to the edge of its page, so the last
 * card in view is cut by the window and not by the page's padding. Only a row that ends exactly
 * at its page's padding gets it; one inside a narrower column keeps its own edge.
 */
function macEndBleed(container: HTMLElement, rtl: boolean): number {
  const page = container.closest<HTMLElement>(".mac-pad");
  if (!page) return 0;
  const padding = Number.parseFloat(getComputedStyle(page).paddingInlineEnd);
  if (!Number.isFinite(padding) || padding <= 0) return 0;
  const pageBox = page.getBoundingClientRect();
  const rowBox = container.getBoundingClientRect();
  const room = rtl ? rowBox.left - pageBox.left : pageBox.right - rowBox.right;
  return Math.abs(room - padding) < 2 ? Math.round(room) : 0;
}

export function usePosterRow(min = 144, kids = false): { min: number; shape: RowShape } {
  const { settings } = useSettings();
  return settings.rowCardStyle === "tv" && !kids
    ? { min: TV_CARD_MIN, shape: "landscape" }
    : { min, shape: "portrait" };
}

const RowTrackContext = createContext<HTMLDivElement | null>(null);
export const ScrollRootContext = createContext<HTMLElement | null>(null);

function LazyChild({
  children,
  eager,
  active,
  shape,
  span,
  expansion,
}: {
  children: ReactNode;
  eager: boolean;
  active: boolean;
  shape: RowShape;
  span?: string;
  expansion?: {
    index: number;
    baseWidth: number;
    /** The cell's width while its card is open, `room` on both sides included. */
    expandedWidth?: number;
    /** Space kept either side of an open card inside its cell (a lifted card on macOS). */
    room: number;
    expanded: boolean;
    previews: boolean;
    /** How long the cell takes to change width, and its curve, when not the default. */
    motion?: { ms: number; ease: string };
    /** Which row the card is in, for cards that wait on one another (card previews). */
    rowId: string;
    onExpand: (index: number, width: number) => void;
    onCollapse: (index: number) => void;
  };
}) {
  const root = useContext(RowTrackContext);
  const [visible, setVisible] = useState(eager && active);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root) return;
    const el = ref.current;
    if (!el) return;
    // An observer rooted in the horizontal track cannot tell whether the entire row is
    // off-screen. Gate it with the row's page visibility before mounting card subscriptions.
    if (!active) {
      const timer = window.setTimeout(() => {
        if (!el.contains(document.activeElement)) setVisible(false);
      }, FAR_RELEASE_MS);
      return () => window.clearTimeout(timer);
    }
    if (eager) startTransition(() => setVisible(true));
    let hideTimer: number | null = null;
    const stopIo = observeWithin(
      el,
      NEAR_MARGIN,
      (entry) => {
        if (entry.isIntersecting) {
          if (hideTimer != null) {
            window.clearTimeout(hideTimer);
            hideTimer = null;
          }
          startTransition(() => setVisible(true));
        } else if (!eager && hideTimer == null) {
          hideTimer = window.setTimeout(() => {
            hideTimer = null;
            if (!el.contains(document.activeElement)) setVisible(false);
          }, FAR_RELEASE_MS);
        }
      },
      root,
    );
    const recheck = window.setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      if (rr.width === 0 || rr.height === 0) return;
      const near = 300;
      const within =
        rect.right > rr.left - near &&
        rect.left < rr.right + near &&
        rect.bottom > rr.top - near &&
        rect.top < rr.bottom + near;
      if (within) startTransition(() => setVisible(true));
    }, 400);
    return () => {
      stopIo();
      window.clearTimeout(recheck);
      if (hideTimer != null) window.clearTimeout(hideTimer);
    };
  }, [root, eager, active]);

  return (
    <div
      ref={ref}
      // The card fades in over the placeholder it replaces; the attribute is only there once it has.
      data-arrives={visible ? "" : undefined}
      data-row-card-index={expansion?.index}
      data-poster-card-cell={expansion ? "" : undefined}
      data-tv-nav-base-width={expansion?.baseWidth}
      className={
        expansion
          ? "relative box-border min-w-0 transition-[flex-basis,padding] duration-[480ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          : undefined
      }
      style={
        expansion
          ? {
              flex: "0 0 auto",
              flexBasis: `${expansion.expandedWidth ?? expansion.baseWidth}px`,
              // Changes with the width, on the same curve, so the card itself follows the
              // width it was asked for.
              paddingInline: `${expansion.room}px`,
              ...(expansion.motion
                ? {
                    transitionDuration: `${expansion.motion.ms}ms`,
                    transitionTimingFunction: expansion.motion.ease,
                  }
                : null),
            }
          : span
            ? { gridColumn: span }
            : undefined
      }
    >
      {visible ? (
        expansion ? (
          <RowCardExpansionProvider
            index={expansion.index}
            enabled
            previews={expansion.previews}
            expanded={expansion.expanded}
            rowId={expansion.rowId}
            onExpand={expansion.onExpand}
            onCollapse={expansion.onCollapse}
          >
            {children}
          </RowCardExpansionProvider>
        ) : (
          children
        )
      ) : (
        <Skeleton shape={shape} />
      )}
    </div>
  );
}

const RESIZE_MOTION: PreviewMotion = { ms: 0, ease: "linear" };

/** Said on `window` once the page's place beside the native sidebar has been written (macOS). */
export const MAC_LAYOUT_APPLIED_EVENT = "harbor:mac-layout-applied";

type RowSizer = () => (() => void) | null;
const rowSizers = new Set<RowSizer>();

// Every row is read first and then all are written in one pass, so the page is laid out
// once for the reads and rendered once for the writes.
function sizeRowsNow(): void {
  const writes: Array<() => void> = [];
  for (const read of rowSizers) {
    const write = read();
    if (write) writes.push(write);
  }
  if (writes.length === 0) return;
  flushSync(() => {
    for (const write of writes) write();
  });
}

function registerRowSizer(sizer: RowSizer): () => void {
  if (rowSizers.size === 0) window.addEventListener(MAC_LAYOUT_APPLIED_EVENT, sizeRowsNow);
  rowSizers.add(sizer);
  return () => {
    rowSizers.delete(sizer);
    if (rowSizers.size === 0) window.removeEventListener(MAC_LAYOUT_APPLIED_EVENT, sizeRowsNow);
  };
}

let pendingWrites: Array<() => void> = [];

function batchWrite(fn: () => void): void {
  pendingWrites.push(fn);
  if (pendingWrites.length > 1) return;
  queueMicrotask(() => {
    const fns = pendingWrites;
    pendingWrites = [];
    // No flushSync here. This runs from every row's ResizeObserver rAF, and forcing a synchronous
    // commit there turned a no-op measurement into a full render pass per row — the layout storm
    // the long-frame profiler kept attributing to this file. React batches these on its own.
    for (const f of fns) f();
  });
}

const Skeleton = memo(function Skeleton({ shape }: { shape: RowShape }) {
  const { settings } = useSettings();
  const radius = settings.posterRadius;
  if (shape === "service") {
    return <div className="h-20 w-full rounded-xl bg-elevated/40" />;
  }
  if (shape === "rank") {
    return (
      <div className="aspect-[228/246] w-full bg-elevated/30" style={{ borderRadius: radius }} />
    );
  }
  if (shape === "tile") {
    return <div className="aspect-[5/4] w-full rounded-2xl bg-elevated/30" />;
  }
  if (shape === "cta") {
    return <div className="h-[108px] w-full rounded-[14px] bg-elevated/40" />;
  }
  const aspect =
    shape === "landscape" ? "aspect-[16/9]" : shape === "square" ? "aspect-square" : "aspect-[2/3]";
  const hideText = shape === "landscape" || (shape === "portrait" && settings.hidePosterTitles);
  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      <div className={`${aspect} bg-elevated/40`} style={{ borderRadius: radius }} />
      {!hideText && (
        <div className="flex flex-col gap-1.5 h-9">
          <div className="h-3 w-3/5 rounded bg-elevated/35" />
          <div className="h-3 w-2/5 rounded bg-elevated/25" />
        </div>
      )}
    </div>
  );
});

export function Row({
  title,
  titleExtra,
  headerDescription,
  className = "",
  min = 144,
  shape = "portrait",
  scrollKey,
  scrollAnchorKey,
  arrowsAlways = false,
  alwaysActive = false,
  children,
  onEndReached,
  onViewAll,
  viewAllLabel = "View all",
  viewAllClassName = "text-ink-subtle hover:text-ink",
  headerRight,
  titleClassName = "text-ink",
  titleScale = 1,
  previews = false,
}: {
  title?: React.ReactNode;
  titleExtra?: React.ReactNode;
  headerDescription?: React.ReactNode;
  className?: string;
  min?: number;
  shape?: RowShape;
  alwaysActive?: boolean;
  arrowsAlways?: boolean;
  scrollKey?: string;
  /** Resets the row to its start when the head item changes. */
  scrollAnchorKey?: string;
  children: React.ReactNode;
  onEndReached?: () => void;
  onViewAll?: () => void;
  viewAllLabel?: string;
  viewAllClassName?: string;
  headerRight?: React.ReactNode;
  titleClassName?: string;
  titleScale?: number;
  /** The row's cards open sideways into a preview when the pointer rests on one (macOS). */
  previews?: boolean;
}) {
  const { settings } = useSettings();
  const t = useT();
  const { rememberRowScroll, recallRowScroll } = useViewActions();
  const pageScrollRoot = useContext(ScrollRootContext);
  const lang = useUiLanguage();
  const rtl = checkRtl(lang);
  const tvCards =
    shape === "portrait" && settings.rowCardStyle === "tv" && holdsPosterCards(children);
  const effShape: RowShape = tvCards ? "landscape" : shape;
  const effMin = Math.max(72, Math.round((tvCards ? TV_CARD_MIN : min) * settings.posterScale));
  // macOS sizes a row from the window (`macRowFit`): tighter gaps, and the next card in view.
  const macRow = isMacDesktop();
  const gap = macRow ? MAC_ROW_GAP : GAP;
  const previewCards =
    cardPreviewsOn(settings) &&
    (previews || (effShape === "portrait" && holdsPosterCards(children)));
  const expandingCards =
    previewCards || (effShape === "portrait" && settings.posterBackdropExpansion);
  const dockEnabled = effShape === "portrait" && settings.posterDockMagnification;
  const posterHeightRatio = effShape === "landscape" ? 9 / 16 : effShape === "square" ? 1 : 1.5;
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const trackCb = useCallback((el: HTMLDivElement | null) => {
    trackRef.current = el;
    setTrackEl(el);
  }, []);
  const [cellWidth, setCellWidth] = useState<number | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [expandedCard, setExpandedCard] = useState<{
    index: number;
    widthScale: number;
  } | null>(null);
  // A card preview opens more slowly and more gently than the keyboard's expanding card, and
  // closes on a return of its own once no card is open.
  const cardMotion = previewCards ? previewMotion(expandedCard !== null) : undefined;
  const expandMs = cardMotion?.ms ?? 480;
  // macOS: a row whose cards changed size (the window, or the sidebar, changed the room it has)
  // takes the new size at once. The width's transition is for a card that opens or closes; on a
  // resize it left the cards at their new size inside cells still easing to theirs, so the gaps
  // between cards opened up and closed again.
  const sizedCellWidthRef = useRef(cellWidth);
  const resized = macRow && sizedCellWidthRef.current !== cellWidth;
  useLayoutEffect(() => {
    sizedCellWidthRef.current = cellWidth;
  });
  const cellMotion = resized ? RESIZE_MOTION : cardMotion;
  const onEndRef = useRef(onEndReached);
  useEffect(() => {
    onEndRef.current = onEndReached;
  });

  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onNear = (e: IntersectionObserverEntry) => {
      startTransition(() => setNear(e.isIntersecting));
    };
    return pageScrollRoot
      ? observeWithin(el, "1600px 0px", onNear, pageScrollRoot)
      : observeWithin(el, "1600px 0px", onNear);
  }, [pageScrollRoot]);
  const measuredRef = useRef({ width: 0, effMin: 0 });
  // macOS: how far the track runs past the row's own edge, to the edge of the page.
  const bleedEndRef = useRef(0);
  // The part of the track a card is brought into when it opens: the row's own width, not the
  // run-off beyond it.
  const revealBounds = (track: HTMLDivElement) => {
    const box = track.getBoundingClientRect();
    const bleed = bleedEndRef.current;
    return rtl
      ? { left: box.left + bleed, right: box.right }
      : { left: box.left, right: box.right - bleed };
  };
  // Width reported by the ResizeObserver for this row's container, so the measurement below does
  // not need a forced layout read.
  const observedWidthRef = useRef(0);
  // The cell width the row should now have, or null when it already has it.
  const sized = (): number | null => {
    const container = containerRef.current;
    if (!container) return null;
    const available = observedWidthRef.current;
    if (available <= 0) return null;
    // The ResizeObserver also fires when the track's height changes, which is posters loading, not
    // a width change. Re-deriving the cell width then wrote the same value and re-laid-out the
    // whole track for nothing.
    const previous = measuredRef.current;
    if (Math.abs(available - previous.width) < 0.5 && effMin === previous.effMin) return null;
    measuredRef.current = { width: available, effMin };
    const fits = Math.max(1, Math.floor((available + gap) / (effMin + gap)));
    const raw = macRow
      ? macRowFit(available, effMin, window.innerWidth).cell
      : (available - (fits - 1) * gap) / fits;
    if (macRow) {
      const bleed = macEndBleed(container, rtl);
      bleedEndRef.current = bleed;
      trackRef.current?.style.setProperty("--row-bleed-end", `${bleed}px`);
    }
    return (Math.ceil(raw * 64) + 1) / 64;
  };
  const measure = () => {
    const next = sized();
    if (next !== null) batchWrite(() => setCellWidth(next));
  };
  const measureRef = useRef(measure);
  const sizedRef = useRef(sized);
  useLayoutEffect(() => {
    measureRef.current = measure;
    sizedRef.current = sized;
  });
  // macOS: while the sidebar slides, the page is laid out once at its new place and what moved
  // is carried there (sidebar-glide.ts). That only works if a row has its new size in that one
  // layout, not a frame or two later when its ResizeObserver reports: so the row can be asked
  // for its size at once.
  useEffect(() => {
    if (!macRow) return;
    return registerRowSizer(() => {
      const container = containerRef.current;
      if (!container) return null;
      const style = getComputedStyle(container);
      const width =
        container.clientWidth -
        (Number.parseFloat(style.paddingLeft) || 0) -
        (Number.parseFloat(style.paddingRight) || 0);
      if (width <= 0) return null;
      observedWidthRef.current = width;
      const next = sizedRef.current();
      return next === null ? null : () => setCellWidth(next);
    });
  }, [macRow]);

  const lastScrollPosRef = useRef(0);
  const readPos = (el: HTMLDivElement) => {
    const pos = rtl ? -el.scrollLeft : el.scrollLeft;
    lastScrollPosRef.current = pos;
    return pos;
  };
  const writePos = (el: HTMLDivElement, pos: number) => {
    lastScrollPosRef.current = pos;
    el.scrollLeft = rtl ? -pos : pos;
  };

  const measureScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const pos = readPos(el);
    const remaining = el.scrollWidth - el.clientWidth - pos;
    batchWrite(() => {
      setCanPrev(pos > 1);
      setCanNext(remaining > 1);
    });
    if (el.clientWidth > 0 && remaining < 800) onEndRef.current?.();
  };

  const drag = useRef({
    active: false,
    moved: false,
    startX: 0,
    startScroll: 0,
    pointerId: -1,
    lastX: 0,
    lastT: 0,
    vel: 0,
  });
  const expansionFrameRef = useRef<number | null>(null);
  const expansionSettleRef = useRef<number | null>(null);
  const hadExpandedCardRef = useRef(false);
  // Where the row stood before a card opened in it, and where this code last put it. Opening a
  // card near the row's end scrolls the row to keep the card whole; closing brings it back.
  const scrollHomeRef = useRef<{ home: number; placed: number } | null>(null);
  const lastExpandedIndexRef = useRef(0);

  const rowId = useId();
  const expandRowCard = useCallback(
    (index: number, width: number) => {
      if (!expandingCards) return;
      const baseWidth = cellWidth ?? effMin;
      const widthScale = Math.max(1, width / baseWidth);
      setExpandedCard((current) => {
        if (current?.index === index && Math.abs(current.widthScale - widthScale) < 0.005) {
          return current;
        }
        return { index, widthScale };
      });
    },
    [cellWidth, effMin, expandingCards],
  );
  const collapseRowCard = useCallback((index: number) => {
    setExpandedCard((current) => (current?.index === index ? null : current));
  }, []);

  const revealExpanded = (track: HTMLDivElement, index: number) => {
    const cell = track.querySelector<HTMLElement>(`[data-row-card-index="${index}"]`);
    if (!cell) return;
    const delta = scrollDeltaToRevealCard(cell.getBoundingClientRect(), revealBounds(track), gap);
    if (Math.abs(delta) > 0.5) track.scrollLeft += delta;
    if (scrollHomeRef.current) scrollHomeRef.current.placed = track.scrollLeft;
  };
  // How far the row has to scroll for a card to be whole once every card has finished changing
  // width: known from the start, so the row can glide there instead of chasing the card's edge.
  const settledRevealDelta = (track: HTMLDivElement, index: number): number | null => {
    const cell = track.querySelector<HTMLElement>(`[data-row-card-index="${index}"]`);
    if (!cell) return null;
    const width = Number.parseFloat(cell.style.flexBasis);
    if (!Number.isFinite(width)) return null;
    // A card before this one may still be closing: it gives its extra width back.
    let surplus = 0;
    for (const other of track.querySelectorAll<HTMLElement>("[data-row-card-index]")) {
      if (other === cell) break;
      const base = Number(other.dataset.tvNavBaseWidth);
      if (Number.isFinite(base)) surplus += other.getBoundingClientRect().width - base;
    }
    const box = cell.getBoundingClientRect();
    const left = rtl ? box.right + surplus - width : box.left - surplus;
    return scrollDeltaToRevealCard({ left, right: left + width }, revealBounds(track), gap);
  };
  // How far a card is through its change of width, to be asked each frame. It is read from the
  // card itself, so the row's scroll keeps exact step with the transition whichever frame the
  // browser started it in. A card whose width has nowhere to go is followed by the clock.
  const widthProgress = (
    track: HTMLDivElement,
    index: number,
    startedAt: number,
    motion: PreviewMotion,
  ): (() => number) => {
    const cell = track.querySelector<HTMLElement>(`[data-row-card-index="${index}"]`);
    const fromWidth = cell?.getBoundingClientRect().width ?? 0;
    const span = (cell ? Number.parseFloat(cell.style.flexBasis) : Number.NaN) - fromWidth;
    if (!cell || !Number.isFinite(span) || Math.abs(span) < 1) {
      return () => easeProgress(motion.ease, (performance.now() - startedAt) / motion.ms);
    }
    return () => Math.min(1, Math.max(0, (cell.getBoundingClientRect().width - fromWidth) / span));
  };
  // The person scrolled the row while a card was open: the row stays where they put it.
  const rowWasMoved = (track: HTMLDivElement) => {
    const kept = scrollHomeRef.current;
    return !kept || drag.current.active || Math.abs(track.scrollLeft - kept.placed) > 2;
  };

  useLayoutEffect(() => {
    const track = trackRef.current;
    const hasExpansion = expandedCard !== null;
    if (!track || (!hasExpansion && !hadExpandedCardRef.current)) return;
    hadExpandedCardRef.current = hasExpansion;
    if (expansionFrameRef.current !== null) cancelAnimationFrame(expansionFrameRef.current);
    if (expansionSettleRef.current !== null) window.clearTimeout(expansionSettleRef.current);
    track.style.scrollSnapType = "none";
    track.style.scrollBehavior = "auto";
    const startedAt = performance.now();
    if (expandedCard) {
      if (!scrollHomeRef.current) {
        scrollHomeRef.current = { home: track.scrollLeft, placed: track.scrollLeft };
      } else if (rowWasMoved(track)) {
        scrollHomeRef.current = null;
      }
      lastExpandedIndexRef.current = expandedCard.index;
      // A card preview's row glides to where the open card will be whole, as far along as the
      // card is in opening. A card already partly off screen then slides in, where chasing its
      // edge frame by frame moved the row the whole distance in the first frame.
      const glide = cardMotion ? settledRevealDelta(track, expandedCard.index) : null;
      const opened = cardMotion
        ? widthProgress(track, expandedCard.index, startedAt, cardMotion)
        : null;
      const from = track.scrollLeft;
      let placed = from;
      const keepExpandedCardVisible = () => {
        expansionFrameRef.current = null;
        if (rowWasMoved(track)) scrollHomeRef.current = null;
        if (opened && glide !== null) {
          const held = drag.current.active || Math.abs(track.scrollLeft - placed) > 2;
          if (!held && Math.abs(glide) > 0.5) {
            track.scrollLeft = from + glide * opened();
            placed = track.scrollLeft;
            if (scrollHomeRef.current) scrollHomeRef.current.placed = placed;
          }
        } else if (!drag.current.active) {
          revealExpanded(track, expandedCard.index);
        }
        if (performance.now() - startedAt < expandMs + 40) {
          expansionFrameRef.current = requestAnimationFrame(keepExpandedCardVisible);
        }
      };
      expansionFrameRef.current = requestAnimationFrame(keepExpandedCardVisible);
    } else if (cardMotion && !rowWasMoved(track)) {
      // The row goes home as far along as the card is in its own return.
      const from = track.scrollLeft;
      const home = scrollHomeRef.current?.home ?? from;
      const closed = widthProgress(track, lastExpandedIndexRef.current, startedAt, cardMotion);
      const returnHome = () => {
        expansionFrameRef.current = null;
        if (rowWasMoved(track)) {
          scrollHomeRef.current = null;
          return;
        }
        const over = performance.now() - startedAt >= cardMotion.ms + 40;
        track.scrollLeft = from + (home - from) * (over ? 1 : closed());
        if (scrollHomeRef.current) scrollHomeRef.current.placed = track.scrollLeft;
        if (!over) expansionFrameRef.current = requestAnimationFrame(returnHome);
        else scrollHomeRef.current = null;
      };
      if (Math.abs(home - from) > 0.5) {
        expansionFrameRef.current = requestAnimationFrame(returnHome);
      } else {
        scrollHomeRef.current = null;
      }
    } else {
      scrollHomeRef.current = null;
    }
    expansionSettleRef.current = window.setTimeout(() => {
      expansionSettleRef.current = null;
      if (expandedCard && !drag.current.active) revealExpanded(track, expandedCard.index);
      if (!expandedCard) track.style.scrollSnapType = "";
      track.style.scrollBehavior = "";
      measureScroll();
    }, expandMs + 60);
  }, [expandedCard]);

  useEffect(
    () => () => {
      if (expansionFrameRef.current !== null) cancelAnimationFrame(expansionFrameRef.current);
      if (expansionSettleRef.current !== null) window.clearTimeout(expansionSettleRef.current);
    },
    [],
  );

  const childCount = Children.count(children);
  const memoryKey =
    scrollKey == null
      ? undefined
      : scrollAnchorKey != null
        ? `${scrollKey}:${scrollAnchorKey}`
        : scrollKey;
  const prevAnchorRef = useRef(scrollAnchorKey);
  const prevMemoryRef = useRef(memoryKey);
  const restoredRef = useRef(false);
  const userInteractedRef = useRef(false);
  // A row nobody has moved does not snap. The Mac's web view settles its snapping on whatever a
  // row holds first; a row that starts with a handful of placeholder cards is too short to scroll,
  // and when the real cards arrive and it becomes scrollable, the web view jumps it to a stale
  // snap position two or three cards in (seen in the app: 0 to 497 px with no input and no script
  // write). Snapping is given back the first time the row is deliberately moved.
  const snapHeldRef = useRef(false);
  useLayoutEffect(() => {
    if (!trackEl || userInteractedRef.current) return;
    trackEl.style.scrollSnapType = "none";
    snapHeldRef.current = true;
  }, [trackEl]);
  const releaseSnapHold = () => {
    if (!snapHeldRef.current) return;
    snapHeldRef.current = false;
    const track = trackRef.current;
    // A glide, a drag or an open card has snapping off for its own reasons and restores it itself.
    if (track && rafId.current == null && !drag.current.active && !hadExpandedCardRef.current) {
      track.style.scrollSnapType = "";
    }
  };
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      measureRef.current();
      measureScroll();
    });
    return () => cancelAnimationFrame(frame);
  }, [childCount, trackEl, cellWidth, effMin, rtl]);
  useLayoutEffect(() => {
    if (!trackEl || cellWidth == null) return;
    if (memoryKey && !restoredRef.current && childCount > 0) {
      const n = recallRowScroll(memoryKey);
      // A fresh track is already at zero. Only a saved nonzero position needs
      // synchronous geometry before paint; reading every new track forces layout.
      if (n != null && n > 0) {
        const max = trackEl.scrollWidth - trackEl.clientWidth;
        const target = max > 0 ? Math.min(n, max) : 0;
        writePos(trackEl, target);
      }
      restoredRef.current = true;
      return;
    }
    if (!userInteractedRef.current && lastScrollPosRef.current !== 0) {
      writePos(trackEl, 0);
    }
  }, [childCount, cellWidth, trackEl, memoryKey, recallRowScroll]);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;
    let roRaf: number | null = null;
    const scheduleMeasure = () => {
      if (roRaf != null) return;
      roRaf = requestAnimationFrame(() => {
        roRaf = null;
        measureRef.current();
        measureScroll();
      });
    };
    // One shared ResizeObserver rather than one per row. A view mounts dozens of rows at once, so
    // each private observer was another object created during the click that switched to it — and
    // the entry already carries the width, so the measurement needs no layout read either.
    const stopContainerResize = observeResize(container, (rect) => {
      if (rect.width <= 0) return;
      if (Math.abs(rect.width - observedWidthRef.current) < 0.5) return;
      observedWidthRef.current = rect.width;
      scheduleMeasure();
    });
    let trackWidth = 0;
    const stopTrackResize = observeResize(track, (rect) => {
      if (rect.width <= 0) return;
      if (Math.abs(rect.width - trackWidth) < 0.5) return;
      trackWidth = rect.width;
      scheduleMeasure();
    });
    let saveTimer: number | null = null;
    let scrollRaf: number | null = null;
    const onScroll = () => {
      readPos(track);
      if (scrollRaf == null) {
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = null;
          measureScroll();
        });
      }
      if (!memoryKey) return;
      if (saveTimer != null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveTimer = null;
        rememberRowScroll(memoryKey, readPos(track));
      }, 200);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    const markInteracted = () => {
      userInteractedRef.current = true;
      releaseSnapHold();
    };
    let wheelSettle: number | null = null;
    // The web view gives a whole swipe to the scroller its first event points at. A downward
    // swipe whose first event leans sideways is given to this row, which cannot scroll down, and
    // the page then stands still for that swipe. So the row watches a swipe that started
    // sideways: if it turns downward before it has moved the row any real distance, the row
    // hands the rest of it to the page.
    let swipe = { last: 0, x: 0, down: 0, downBy: 0, startedSideways: false, settled: false };
    let passTo: HTMLElement | null = null;
    let passedTop = 0;
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now - swipe.last > SWIPE_GAP_MS) {
        swipe = {
          last: now,
          x: 0,
          down: 0,
          downBy: 0,
          startedSideways: Math.abs(e.deltaX) > Math.abs(e.deltaY),
          settled: e.deltaMode !== 0,
        };
        passTo = null;
      }
      swipe.last = now;
      swipe.x += Math.abs(e.deltaX);
      // How many events in a row have gone clearly downward (or upward), and how far.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) * 2) {
        swipe.down += 1;
        swipe.downBy += Math.abs(e.deltaY);
      } else {
        swipe.down = 0;
        swipe.downBy = 0;
      }
      if (passTo) {
        // Something else is moving the page as well: the swipe was the page's after all.
        if (Math.abs(passTo.scrollTop - passedTop) > 1) {
          passTo = null;
          swipe.settled = true;
          return;
        }
        passTo.scrollTop += e.deltaY;
        passedTop = passTo.scrollTop;
        return;
      }
      if (swipe.startedSideways && !swipe.settled) {
        if (swipe.x >= SWIPE_SIDEWAYS_PX) {
          swipe.settled = true;
        } else if (swipe.down >= 2 && swipe.downBy >= SWIPE_DOWNWARD_PX) {
          swipe.settled = true;
          passTo = pageScrollerOf(track);
          if (passTo) {
            passTo.scrollTop += e.deltaY;
            passedTop = passTo.scrollTop;
            return;
          }
        }
      }
      userInteractedRef.current = true;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (rafId.current != null && Math.abs(e.deltaX) < 4) return;
      cancelGlide();
      track.style.scrollSnapType = "none";
      track.style.scrollBehavior = "auto";
      if (wheelSettle != null) window.clearTimeout(wheelSettle);
      wheelSettle = window.setTimeout(() => {
        wheelSettle = null;
        const stride = strideRef.current;
        const max = track.scrollWidth - track.clientWidth;
        if (max <= 0 || stride <= 0) {
          track.style.scrollSnapType = "";
          track.style.scrollBehavior = "";
          return;
        }
        const pos = readPos(track);
        const aligned = Math.max(0, Math.min(Math.round(pos / stride) * stride, max));
        const target = max - pos < stride * 0.5 ? max : aligned;
        glideTo(track, target, true);
      }, 200);
    };
    track.addEventListener("wheel", onWheel, { passive: true });
    track.addEventListener("pointerdown", markInteracted);
    track.addEventListener("keydown", markInteracted);
    let resetRaf: number | null = null;
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<{ prefix?: string }>).detail;
      if (!scrollKey) return;
      if (!detail?.prefix || !scrollKey.startsWith(detail.prefix)) return;
      // Deferred by one frame. This fires from the click handler that switches views, and every
      // matching row used to write scrollLeft and then read scrollWidth right there — a forced
      // layout per row, synchronously inside the click. Coalescing the writes into a single frame
      // lets the browser lay out once, after the click has already been handled. The write below
      // still fires the track's own scroll handler, which is what updates the arrows.
      if (resetRaf != null) return;
      resetRaf = requestAnimationFrame(() => {
        resetRaf = null;
        if (saveTimer != null) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        writePos(track, 0);
        if (memoryKey) rememberRowScroll(memoryKey, 0);
        userInteractedRef.current = false;
      });
    };
    window.addEventListener("harbor:reset-row-scrolls", onReset);
    return () => {
      stopContainerResize();
      stopTrackResize();
      if (roRaf != null) cancelAnimationFrame(roRaf);
      if (scrollRaf != null) cancelAnimationFrame(scrollRaf);
      if (resetRaf != null) cancelAnimationFrame(resetRaf);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("wheel", onWheel);
      track.removeEventListener("pointerdown", markInteracted);
      track.removeEventListener("keydown", markInteracted);
      window.removeEventListener("harbor:reset-row-scrolls", onReset);
      if (saveTimer != null) window.clearTimeout(saveTimer);
      if (wheelSettle != null) window.clearTimeout(wheelSettle);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      if (memoryKey && lastScrollPosRef.current > 0) {
        rememberRowScroll(memoryKey, lastScrollPosRef.current);
      }
    };
  }, [scrollKey, memoryKey, rememberRowScroll]);

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    userInteractedRef.current = true;
    cancelGlide();
    const cur = rtl ? -el.scrollLeft : el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    const stride = strideRef.current;
    const raw = cur + dir * el.clientWidth;
    const target = Math.max(0, Math.min(max, Math.round(raw / stride) * stride));
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.scrollLeft = rtl ? -target : target;
      return;
    }
    el.style.scrollSnapType = "none";
    glideTo(el, target, false);
  };

  const rafId = useRef<number | null>(null);
  const strideRef = useRef(effMin + gap);
  strideRef.current = (cellWidth ?? effMin) + gap;

  const dockFrameRef = useRef<number | null>(null);
  const dockPointerXRef = useRef<number | null>(null);
  const resetPosterDock = useCallback(() => {
    const track = trackRef.current;
    if (track) resetPosterDockItems(track);
  }, []);
  const applyPosterDock = useCallback(() => {
    dockFrameRef.current = null;
    const track = trackRef.current;
    const pointerX = dockPointerXRef.current;
    if (!dockEnabled || !track || pointerX === null) {
      resetPosterDock();
      return;
    }
    updatePosterDock({
      track,
      pointerX,
      cellWidth: cellWidth ?? effMin,
      gap: gap,
      scrollPosition: rtl ? -track.scrollLeft : track.scrollLeft,
      rtl,
      transitionMs: settings.posterDockTransitionMs,
    });
  }, [cellWidth, dockEnabled, effMin, resetPosterDock, rtl, settings.posterDockTransitionMs]);
  const schedulePosterDock = useCallback(
    (clientX: number) => {
      dockPointerXRef.current = clientX;
      if (dockFrameRef.current === null) {
        dockFrameRef.current = requestAnimationFrame(applyPosterDock);
      }
    },
    [applyPosterDock],
  );
  useEffect(
    () => () => {
      if (dockFrameRef.current !== null) cancelAnimationFrame(dockFrameRef.current);
      resetPosterDock();
    },
    [resetPosterDock],
  );
  useEffect(() => {
    if (!dockEnabled) resetPosterDock();
  }, [dockEnabled, resetPosterDock]);

  const cancelGlide = () => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };

  const glideTo = (el: HTMLDivElement, target: number, snappy = false) => {
    const start = rtl ? -el.scrollLeft : el.scrollLeft;
    const distance = target - start;
    if (Math.abs(distance) < 2) {
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
      return;
    }
    const startTime = performance.now();
    const duration = snappy
      ? Math.max(140, Math.min(300, Math.abs(distance) * 0.9))
      : Math.max(280, Math.min(620, 260 + Math.abs(distance) * 0.45));
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + distance * eased;
      el.scrollLeft = rtl ? -next : next;
      if (t < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        rafId.current = null;
        el.style.scrollSnapType = "";
        el.style.scrollBehavior = "";
      }
    };
    rafId.current = requestAnimationFrame(tick);
  };

  useLayoutEffect(() => {
    const previousAnchor = prevAnchorRef.current;
    const previousMemory = prevMemoryRef.current;
    prevAnchorRef.current = scrollAnchorKey;
    prevMemoryRef.current = memoryKey;
    if (previousAnchor === scrollAnchorKey) return;
    // The head changing means the previous snapshot is no longer relevant.
    // Clear it so switching back to an old head cannot restore a hidden start.
    if (previousMemory) rememberRowScroll(previousMemory, 0);
    const track = trackRef.current;
    if (track) {
      cancelGlide();
      writePos(track, 0);
    }
    if (memoryKey) rememberRowScroll(memoryKey, 0);
    userInteractedRef.current = false;
  }, [scrollAnchorKey, memoryKey, rememberRowScroll]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dockPointerXRef.current = null;
    resetPosterDock();
    if (e.button !== 0 || e.pointerType === "touch") return;
    if (!(e.target as Element).closest("button")) return;
    const el = trackRef.current;
    if (!el) return;
    cancelGlide();
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastT: performance.now(),
      vel: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dockEnabled && e.pointerType !== "touch" && e.buttons === 0 && !drag.current.active) {
      schedulePosterDock(e.clientX);
    }
    const d = drag.current;
    const el = trackRef.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      try {
        el.setPointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) {
      const instant = (e.clientX - d.lastX) / dt;
      d.vel = d.vel * 0.55 + instant * 0.45;
    }
    d.lastX = e.clientX;
    d.lastT = now;
    el.scrollLeft = d.startScroll - dx;
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    d.active = false;
    if (!d.moved || !el) {
      setTimeout(() => {
        drag.current.moved = false;
      }, 0);
      return;
    }
    try {
      if (e) el.releasePointerCapture(d.pointerId);
    } catch {
      /* ignore */
    }

    const friction = 0.004;
    const v = d.vel;
    const projection = -((v * Math.abs(v)) / (2 * friction));
    const projectedRaw = el.scrollLeft + projection;
    const projected = rtl ? -projectedRaw : projectedRaw;
    const stride = (cellWidth ?? effMin) + gap;
    const max = el.scrollWidth - el.clientWidth;
    const targetIdx = Math.round(projected / stride);
    const target = Math.max(0, Math.min(targetIdx * stride, max));
    glideTo(el, target);

    setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const trackPad = dockEnabled ? "pb-8 pt-14 -mb-8 -mt-14" : "py-5 -my-5 px-2 -mx-2 scroll-px-2";
  // macOS: how much this row's cards grow when they lift (`.mac-lift`).
  const rowLift = macRow ? liftScale(cellWidth ?? effMin) : 1;
  const hasHeader = !!(title || onViewAll || headerRight);
  const shellRoom = hasHeader ? "" : dockEnabled ? "py-14 -my-14" : "py-5 -my-5";

  return (
    <div
      // A row that is added to a page already on screen (its titles came in later) fades in.
      data-arrives=""
      className={`harbor-row-shell flex min-w-0 flex-col gap-5 ps-[9px] ${shellRoom} ${className}`}
    >
      {hasHeader && (
        <div
          className="relative z-20 flex items-baseline justify-between gap-4 pe-1"
          onPointerEnter={() => {
            if (dockEnabled) {
              dockPointerXRef.current = null;
              resetPosterDock();
            }
          }}
          onPointerMove={() => {
            if (dockEnabled) {
              dockPointerXRef.current = null;
              resetPosterDock();
            }
          }}
        >
          {title && (
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <h3
                  className={`mac-type-heading truncate font-medium tracking-tight ${titleClassName}`}
                  style={{ fontSize: `${Math.round(17 * settings.rowTitleScale * titleScale)}px` }}
                >
                  {title}
                </h3>
                {titleExtra}
              </div>
              {headerDescription}
            </div>
          )}
          {(onViewAll || headerRight) && (
            <div className="flex shrink-0 items-center gap-3">
              {headerRight}
              {onViewAll && (
                <button
                  type="button"
                  onClick={onViewAll}
                  className={`mac-type-small group/va inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium transition-colors ${viewAllClassName}`}
                >
                  {t(viewAllLabel)}
                  <ChevronRight
                    size={14}
                    strokeWidth={2.2}
                    className="dir-icon transition-transform duration-200 group-hover/va:translate-x-0.5"
                  />
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div ref={containerRef} className="group/row relative min-w-0">
        <RowTrackContext.Provider value={trackEl}>
          <div
            ref={trackCb}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => {
              endDrag(event);
              if (dockEnabled && event.pointerType !== "touch") schedulePosterDock(event.clientX);
            }}
            onPointerCancel={(event) => {
              endDrag(event);
              dockPointerXRef.current = null;
              resetPosterDock();
            }}
            onPointerLeave={() => {
              dockPointerXRef.current = null;
              resetPosterDock();
            }}
            onClickCapture={onClickCapture}
            onDragStart={(e) => e.preventDefault()}
            data-far={near ? undefined : ""}
            data-card-previews={previewCards ? "" : undefined}
            className={`harbor-row-track items-start ${macRow ? "gap-3" : "gap-5"} overflow-x-auto overflow-y-hidden ${trackPad} [scroll-snap-type:x_mandatory] [&>*]:[scroll-snap-align:start] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [overflow-anchor:none] [overscroll-behavior-x:contain] [&_img]:select-none [&_img]:[-webkit-user-drag:none] ${
              expandingCards
                ? "harbor-expanding-card-scope harbor-expanding-row flex flex-nowrap"
                : "grid grid-flow-col"
            }`}
            style={
              {
                "--row-poster-height": `${(cellWidth ?? effMin) * posterHeightRatio}px`,
                ...(macRow ? { "--mac-lift-scale": rowLift } : {}),
                // How long the width change now under way takes: a card's layers keep time by it.
                "--row-expand-ms": `${expandMs}ms`,
                ...(previewCards ? { "--pv-trailer-out-ms": `${PREVIEW_TRAILER_OUT_MS}ms` } : {}),
                ...(expandingCards
                  ? {}
                  : { gridAutoColumns: cellWidth != null ? `${cellWidth}px` : `${effMin}px` }),
                transform: near ? "translateZ(0)" : undefined,
                contain: expandingCards ? "style" : "layout style",
              } as React.CSSProperties
            }
          >
            {Children.map(children, (child, i) => {
              const span = isValidElement(child)
                ? (child.props as { style?: { gridColumn?: string } }).style?.gridColumn
                : undefined;
              const spanCount = columnSpan(span);
              const baseWidth = (cellWidth ?? effMin) * spanCount + gap * (spanCount - 1);
              const expanded = expandedCard?.index === i;
              const desiredExpandedWidth =
                expanded && expandedCard
                  ? (cellWidth ?? effMin) * expandedCard.widthScale
                  : undefined;
              const viewportLimit = Math.max(
                baseWidth,
                (observedWidthRef.current || measuredRef.current.width || baseWidth) - gap * 2,
              );
              const fittedWidth =
                desiredExpandedWidth === undefined
                  ? undefined
                  : Math.max(baseWidth, Math.min(desiredExpandedWidth, viewportLimit));
              // macOS: an open card is also lifted, so its cell keeps room either side of it
              // and the cards beside it stay as far off as they are from a lifted poster.
              const liftedRow = macRow && previewCards;
              const openWidth =
                fittedWidth !== undefined && liftedRow
                  ? openWidthWithin(
                      fittedWidth,
                      baseWidth,
                      viewportLimit,
                      rowLift,
                      OPEN_CARD_CLEAR_PX,
                    )
                  : fittedWidth;
              const room =
                openWidth !== undefined && liftedRow
                  ? liftRoom(openWidth, baseWidth, rowLift, OPEN_CARD_CLEAR_PX)
                  : 0;
              const expandedWidth = openWidth === undefined ? undefined : openWidth + 2 * room;
              return (
                <LazyChild
                  eager={alwaysActive || i < EAGER_COUNT}
                  active={alwaysActive || near}
                  shape={effShape}
                  span={span}
                  expansion={
                    expandingCards
                      ? {
                          index: i,
                          baseWidth,
                          expandedWidth,
                          room,
                          expanded,
                          previews: previewCards,
                          motion: cellMotion,
                          rowId,
                          onExpand: expandRowCard,
                          onCollapse: collapseRowCard,
                        }
                      : undefined
                  }
                >
                  {child}
                </LazyChild>
              );
            })}
          </div>
        </RowTrackContext.Provider>
        <EdgeArrow side="left" visible={canPrev} always={arrowsAlways} onClick={() => scroll(-1)} />
        <EdgeArrow side="right" visible={canNext} always={arrowsAlways} onClick={() => scroll(1)} />
      </div>
    </div>
  );
}

function EdgeArrow({
  side,
  visible,
  always = false,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  always?: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const label = t(side === "left" ? "Scroll left" : "Scroll right");
  if (settings.liquidGlass) {
    const sideClass = side === "left" ? "start-0 justify-start" : "end-0 justify-end";
    return (
      <div
        className={`pointer-events-none absolute inset-y-0 z-30 flex w-14 items-center ${sideClass} ${
          always ? `transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}` : ""
        }`}
      >
        <ThreeLiquidGlassSurface
          radius="9999px"
          shaderRadius={0.58}
          intensity={0.9}
          interactive={false}
          alwaysActive
          style={{
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.04)",
          }}
          className={`h-11 w-11 pointer-events-auto border border-white/[0.06] transition-opacity duration-200 ${
            visible
              ? "opacity-85 group-hover/row:opacity-100 focus-within:opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          contentClassName="flex h-full w-full items-center justify-center"
        >
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            tabIndex={visible ? 0 : -1}
            className="flex h-full w-full items-center justify-center rounded-full bg-transparent text-ink outline-none"
          >
            {side === "left" ? (
              <ChevronLeft size={22} strokeWidth={2.2} className="dir-icon" />
            ) : (
              <ChevronRight size={22} strokeWidth={2.2} className="dir-icon" />
            )}
          </button>
        </ThreeLiquidGlassSurface>
      </div>
    );
  }
  const enter = side === "left" ? "-translate-x-2.5" : "translate-x-2.5";
  const chev = !visible
    ? "opacity-0"
    : always
      ? "opacity-100"
      : `opacity-0 ${enter} scale-[0.6] group-hover/edge:opacity-100 group-hover/edge:translate-x-0 group-hover/edge:scale-100 group-focus-visible/edge:opacity-100 group-focus-visible/edge:translate-x-0 group-focus-visible/edge:scale-100`;
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-30 flex w-16 -translate-y-[7%] items-center ${
        side === "left" ? "start-[-40px] justify-start" : "end-[-40px] justify-end"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        tabIndex={visible ? 0 : -1}
        data-tv-skip="true"
        className={`group/edge grid h-full w-full place-items-center ${
          visible ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <span
          className={`grid place-items-center text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] transition-all duration-[320ms] ease-[cubic-bezier(0.34,1.45,0.5,1)] group-active/edge:scale-90 ${chev}`}
        >
          <NavChevron dir={side} size={54} />
        </span>
      </button>
    </div>
  );
}

import type { NativeLayout } from "./native-events";
import { glideLayout } from "./sidebar-glide";

/** Gap between the floating sidebar and the content beside it, both sides. */
const SIDEBAR_GUTTER = 16;

/**
 * CSS lengths the web layout uses to stay clear of native chrome. Swift
 * reports screen points; Harbor's interface scale zooms the page, so a CSS
 * pixel is `scale` points wide and the lengths have to be divided by it.
 */
export function layoutInsets(
  layout: NativeLayout,
  scale = 1,
): { titlebar: string; sidebar: string; controls: string } {
  const zoom = scale > 0 ? scale : 1;
  const css = (points: number) => `${Math.round((points / zoom) * 100) / 100}px`;
  return {
    titlebar: css(layout.titlebarInset),
    sidebar: layout.sidebarVisible ? css(layout.sidebarWidth + SIDEBAR_GUTTER) : "0px",
    controls: css(layout.controlsInset),
  };
}

/**
 * The interface scale heroes are drawn at. Zooming the interface changes the
 * size of everything else on a page; a hero keeps the size it has at this scale.
 */
export const HERO_SCALE = 0.8;

/** The CSS `zoom` that cancels the interface scale for a hero (`.mac-zoom-fixed`). */
export function heroZoom(scale = 1): number {
  const zoom = scale > 0 ? scale : 1;
  return Math.round((HERO_SCALE / zoom) * 10000) / 10000;
}

/**
 * The CSS `zoom` that undoes `heroZoom` for a hero's text and buttons
 * (`.mac-hero-text`): the picture keeps its size, the words follow the page.
 */
export function heroTextZoom(scale = 1): number {
  return Math.round((1 / heroZoom(scale)) * 10000) / 10000;
}

let lastLayout: NativeLayout | null = null;
let interfaceScale = 1;
/** The sidebar's width as last reported while it was showing. */
let shownSidebarWidth = 0;
/** Whether the view in front has a sidebar, as the page last said. */
let sidebarWanted: boolean | null = null;
/**
 * What `expectSidebar` wrote ahead of the native side's report, until a report agrees or
 * this long has passed. The native side answers other requests in between with the
 * state it still has; taking that for news put the old inset back for a moment.
 */
let expected: SidebarExpectation | null = null;
const EXPECTED_FOR_MS = 1500;

export type SidebarExpectation = { shown: boolean; until: number };

/**
 * A report read against what was written ahead of it. A report that agrees ends the
 * wait, as does time; one that does not is taken for everything but the sidebar, which
 * stays as expected at `shownWidth`.
 */
export function readReport(
  reported: NativeLayout,
  waiting: SidebarExpectation | null,
  now: number,
  shownWidth: number,
): { layout: NativeLayout; waiting: SidebarExpectation | null } {
  if (!waiting || now > waiting.until || reported.sidebarVisible === waiting.shown)
    return { layout: reported, waiting: null };
  return {
    layout: {
      ...reported,
      sidebarVisible: waiting.shown,
      sidebarWidth: waiting.shown ? shownWidth : 0,
      sidebarMotionMs: 0,
    },
    waiting,
  };
}

function write(): void {
  document.documentElement.style.setProperty("--mac-hero-zoom", String(heroZoom(interfaceScale)));
  document.documentElement.style.setProperty(
    "--mac-hero-text-zoom",
    String(heroTextZoom(interfaceScale)),
  );
  if (!lastLayout) return;
  const insets = layoutInsets(lastLayout, interfaceScale);
  const style = document.documentElement.style;
  style.setProperty("--mac-titlebar-inset", insets.titlebar);
  style.setProperty("--mac-sidebar-inset", insets.sidebar);
  style.setProperty("--mac-controls-inset", insets.controls);
}

/**
 * The curve the native sidebar slides on (`SidebarHost.slideCurve`): the page's
 * content moves beside it on the same one, over the time the layout report gives.
 */
const SIDEBAR_SLIDE_EASE = "cubic-bezier(0.3, 0, 0.1, 1)";
/** Said on `window` once the insets are written; `Row` listens (the same name in row.tsx). */
const MAC_LAYOUT_APPLIED_EVENT = "harbor:mac-layout-applied";

/**
 * Writes the insets and has whatever sizes itself from its room (the rows) do so now, in
 * the same layout, so the glide carries things to where they will stay.
 */
function writeAndSettle(): void {
  write();
  window.dispatchEvent(new Event(MAC_LAYOUT_APPLIED_EVENT));
}

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function applyNativeLayout(reported: NativeLayout): void {
  const read = readReport(reported, expected, performance.now(), shownSidebarWidth);
  const layout = read.layout;
  expected = read.waiting;
  const moved = lastLayout !== null && lastLayout.sidebarVisible !== layout.sidebarVisible;
  const ms = layout.sidebarMotionMs ?? 0;
  lastLayout = layout;
  if (layout.sidebarVisible) shownSidebarWidth = layout.sidebarWidth;
  // The sidebar is sliding: the content beside it moves with it. At every other moment the
  // insets are written at once, so a page that loads with the sidebar open, or a view that
  // has no sidebar, never glides into place.
  if (moved && ms > 0 && !reducedMotion()) glideLayout(writeAndSettle, ms, SIDEBAR_SLIDE_EASE);
  else write();
}

/**
 * Called by the page in the render that says whether the view in front has a
 * sidebar (`wanted`) and whether the person keeps it hidden (`collapsed`).
 *
 * When a change of page gains or loses the sidebar, the sidebar's own report
 * of that takes a trip to the native side and back; until it came, the new
 * page was laid out at the old page's inset and then jumped sideways in front
 * of the person. Writing what the report will say lets the page be laid out
 * once, where it will stay; the report then changes nothing.
 *
 * When the person shows or hides the sidebar themselves nothing is written
 * here: the page waits for the report and glides beside the sidebar.
 */
export function expectSidebar(wanted: boolean, collapsed: boolean): void {
  const pageChanged = sidebarWanted !== null && sidebarWanted !== wanted;
  sidebarWanted = wanted;
  const shown = wanted && !collapsed;
  // What was written ahead stands for the request before this one only. Left standing, it
  // would take the report of this one for a stale report and never be corrected.
  expected = null;
  if (!pageChanged || !lastLayout || lastLayout.sidebarVisible === shown) return;
  if (shown && shownSidebarWidth === 0) return;
  expected = { shown, until: performance.now() + EXPECTED_FOR_MS };
  lastLayout = {
    ...lastLayout,
    sidebarVisible: shown,
    sidebarWidth: shown ? shownSidebarWidth : 0,
  };
  writeAndSettle();
}

/** Call whenever Harbor's interface scale setting changes. */
export function setNativeLayoutScale(scale: number): void {
  interfaceScale = scale;
  write();
}

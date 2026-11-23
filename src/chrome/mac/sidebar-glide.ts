/**
 * The page's part of the sidebar's slide. When the native sidebar slides in or
 * out, the page's content changes place by the sidebar's width. Laying the page
 * out again on every frame of that movement is far too slow to look like
 * movement (five frames in the app's web view on a small Home), so the page is
 * laid out once, at its new place, and what moved is carried from where it was
 * to where it now is by a transform, which costs no layout at all.
 *
 * Each element is moved by what its own place changed by, less what the
 * elements around it already make up for, so a page that only moves its text
 * and rows (artwork stays under the sidebar) moves only those.
 */

/**
 * Looked at and moved as one piece: what is inside them is never measured. A row's
 * track keeps its own box and moves its cards by its padding, so its cards are
 * measured, each as one piece.
 */
const WHOLE =
  "[data-media-card], .harbor-row-track > *, button, a, p, svg, img, video, canvas, input, h1, h2, h3, h4";
/** Neither measured nor moved: pages that are not showing. */
const SKIPPED = "[data-layer-inactive], script, style, template";
/**
 * Never moved itself, only looked into: it holds every page, and a transform on
 * it would re-anchor whatever a page fixes to the window.
 */
const PASSED_THROUGH = ".mac-stage";
const MAX_NODES = 2500;
const MAX_DEPTH = 18;

export type GlideNode = {
  /** Index of the nearest measured ancestor, or -1. */
  parent: number;
  /** Left edge before and after the layout changed. */
  before: number;
  after: number;
  /** The element is only looked into, never moved. */
  passed?: boolean;
};

/**
 * How far each element has to be carried: what its place changed by, less the
 * sum its ancestors are carried by already. Nodes list ancestors before their
 * descendants.
 */
export function residualShifts(nodes: readonly GlideNode[]): number[] {
  const carried: number[] = [];
  return nodes.map((node, index) => {
    const inherited = node.parent >= 0 ? carried[node.parent] : 0;
    const shift = node.after - node.before - inherited;
    const own = !node.passed && Math.abs(shift) > 0.5 ? shift : 0;
    carried[index] = inherited + own;
    return own;
  });
}

type Seen = { el: HTMLElement; parent: number; before: number; passed: boolean };

function measure(root: Element): Seen[] {
  const seen: Seen[] = [];
  const queue: Array<{ el: Element; parent: number; depth: number }> = [
    { el: root, parent: -1, depth: 0 },
  ];
  const height = window.innerHeight;
  for (let i = 0; i < queue.length && seen.length < MAX_NODES; i++) {
    const { el, parent, depth } = queue[i];
    if (!(el instanceof HTMLElement) || el.matches(SKIPPED)) continue;
    const box = el.getBoundingClientRect();
    let index = parent;
    // An element with no box of its own (`display: contents`) still has children that have one.
    if (box.width > 0 || box.height > 0) {
      // Out of sight above or below: nothing of it is seen moving.
      if (box.bottom < 0 || box.top > height) continue;
      index = seen.push({ el, parent, before: box.left, passed: el.matches(PASSED_THROUGH) }) - 1;
    }
    if (depth >= MAX_DEPTH || el.matches(WHOLE)) continue;
    for (const child of el.children) queue.push({ el: child, parent: index, depth: depth + 1 });
  }
  return seen;
}

let running: Animation[] = [];

/**
 * Runs `apply`, which changes where the page's content sits, and carries what
 * moved from its old place to its new one over `ms` on `easing`.
 */
export function glideLayout(apply: () => void, ms: number, easing: string): void {
  const root = document.getElementById("root") ?? document.body;
  // Measured with a glide still under way included, so a second slide starts from where
  // things are on screen, not from where they were heading.
  const seen = measure(root);
  for (const animation of running) animation.cancel();
  running = [];
  apply();
  const shifts = residualShifts(
    seen.map((node) => ({
      parent: node.parent,
      before: node.before,
      after: node.el.getBoundingClientRect().left,
      passed: node.passed,
    })),
  );
  const moves: Array<{ el: HTMLElement; shift: number; rest: string }> = [];
  shifts.forEach((shift, index) => {
    if (shift === 0) return;
    const el = seen[index].el;
    // The element's own transform, if it has one, stays under the movement. It is written
    // into the keyframes, not added by the engine: the app's web view only runs a transform
    // off the main thread when the animation replaces the value outright.
    const own = getComputedStyle(el).transform;
    moves.push({ el, shift, rest: own && own !== "none" ? own : "" });
  });
  for (const { el, shift, rest } of moves) {
    running.push(
      el.animate(
        [
          { transform: `translateX(${-shift}px) ${rest}`.trim() },
          { transform: rest || "translateX(0px)" },
        ],
        { duration: ms, easing },
      ),
    );
  }
}

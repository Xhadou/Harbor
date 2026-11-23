/**
 * While one preview is open and the pointer rests on another card of its row,
 * that card is about to take the preview over. The open card waits for it, so
 * the two change places in one movement: were the open card to close first, the
 * row would slide under the resting pointer and put a different card there.
 * A card in another row is no reason to wait: nothing there moves this row.
 *
 * `createTakeover` takes its clock so the rule can be tested without waiting.
 */
export type Takeover = {
  /** A card of `row` began its wait to open: it takes the preview over in `delayMs`. */
  announce: (row: string, delayMs: number) => void;
  /** That card was left, has opened, or has given up: nothing is waiting any more. */
  cancel: () => void;
  /** How long until a waiting card of `row` opens; 0 when none is waiting there. */
  waitMs: (row: string) => number;
  /** The pointer left `row` altogether: nothing will take over there, and its open card is told. */
  leftRow: (row: string) => void;
  /** Runs `fn` each time the pointer leaves `row`; the returned call stops it. */
  onLeftRow: (row: string, fn: () => void) => () => void;
};

export function createTakeover(now: () => number): Takeover {
  let waiting: { row: string; dueAt: number } | null = null;
  const listeners = new Set<{ row: string; fn: () => void }>();
  return {
    announce(row, delayMs) {
      waiting = { row, dueAt: now() + Math.max(0, delayMs) };
    },
    cancel() {
      waiting = null;
    },
    waitMs(row) {
      if (!waiting || waiting.row !== row) return 0;
      return Math.max(0, waiting.dueAt - now());
    },
    leftRow(row) {
      if (waiting?.row === row) waiting = null;
      for (const listener of listeners) if (listener.row === row) listener.fn();
    },
    onLeftRow(row, fn) {
      const listener = { row, fn };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The one takeover the app's cards share: the pointer is on one card at a time. */
export const previewTakeover = createTakeover(() => performance.now());

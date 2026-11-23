/**
 * A preview belongs to the card the person is on. When another card of the same
 * row comes under the pointer or takes keyboard focus, the card that is open is
 * told, and closes at once instead of waiting out the short grace it gives a
 * pointer that has only slipped off its edge.
 */
export type RowFocus = {
  /** A card of `row` came under the pointer or took keyboard focus. */
  movedOn: (row: string) => void;
  /** Runs `fn` each time focus moves to a card of `row`; the returned call stops it. */
  onMovedOn: (row: string, fn: () => void) => () => void;
};

export function createRowFocus(): RowFocus {
  const listeners = new Set<{ row: string; fn: () => void }>();
  return {
    movedOn(row) {
      for (const listener of listeners) if (listener.row === row) listener.fn();
    },
    onMovedOn(row, fn) {
      const listener = { row, fn };
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The one the app's cards share. */
export const previewRowFocus = createRowFocus();

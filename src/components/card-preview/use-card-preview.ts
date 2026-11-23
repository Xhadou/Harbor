import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";
import { useRowCardExpansion } from "@/components/row-card-expansion";
import {
  PREVIEW_LEAVE_AWAY_MS,
  PREVIEW_LEAVE_MS,
  PREVIEW_LOOKUP_MS,
  PREVIEW_OPEN_MS,
  previewOpenDelay,
} from "@/lib/card-preview/policy";
import { markPreviewOpen, sinceLastPreviewMs } from "@/lib/card-preview/store";
import { previewTakeover } from "@/lib/card-preview/takeover";

const READY_RETRY_MS = 100;
const READY_RETRIES = 30;
// A closing card keeps what it showed until its width is back, whichever return it is on.
const CLOSING_MS = PREVIEW_OPEN_MS + 120;
// How soon after a waiting card was due to open the open card looks again.
const TAKEOVER_GRACE_MS = 80;

/**
 * Whether the pointer left a card through its side, toward the next card in the
 * row, and not over its top or bottom edge, out of the row.
 */
function leftSideways(card: Element, clientY: number): boolean {
  const box = card.getBoundingClientRect();
  return clientY >= box.top && clientY <= box.bottom;
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function pointerModality(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-input-modality") === "pointer"
  );
}

/**
 * Opens a card into its preview once the pointer (or keyboard focus) has
 * rested on it, and closes it shortly after it leaves. The row does the
 * widening; `measure` says how wide the open card is.
 */
export function useCardPreview(measure: () => number, allowed = true) {
  const row = useRowCardExpansion();
  const enabled = allowed && row?.previews === true;
  const open = enabled && row?.expanded === true;
  const rowId = row?.rowId ?? "";
  // True a moment after the pointer arrives and for as long as the card is open:
  // the time to look up what the preview will play.
  const [wanted, setWanted] = useState(false);
  // True from the moment the card stops being open until it has finished closing. It is set
  // while rendering, so there is no frame in which the card is neither open nor closing.
  const [closing, setClosing] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setClosing(!open);
  }
  const inside = useRef(false);
  const timers = useRef<{ open: number | null; lookup: number | null; leave: number | null }>({
    open: null,
    lookup: null,
    leave: null,
  });
  const rowRef = useRef(row);
  rowRef.current = row;
  const measureRef = useRef(measure);
  measureRef.current = measure;

  const clear = useCallback((which: "open" | "lookup" | "leave") => {
    const id = timers.current[which];
    if (id === null) return;
    window.clearTimeout(id);
    timers.current[which] = null;
  }, []);

  const arrive = useCallback(() => {
    if (!enabled || reducedMotion()) return;
    inside.current = true;
    clear("leave");
    if (rowRef.current?.expanded) return;
    clear("lookup");
    timers.current.lookup = window.setTimeout(() => {
      timers.current.lookup = null;
      if (inside.current) setWanted(true);
    }, PREVIEW_LOOKUP_MS);
    clear("open");
    // A card may not be ready the moment its wait is over (a poster opens onto a wide picture
    // that is still loading): `measure` answers 0 until it is, and the card is asked again for
    // a few seconds while the pointer stays.
    const tryOpen = (triesLeft: number) => {
      timers.current.open = null;
      if (!inside.current) return;
      const width = measureRef.current();
      if (width > 0) {
        previewTakeover.cancel();
        rowRef.current?.expand(width);
      } else if (triesLeft > 0) {
        // Still about to open: the card that is open now goes on waiting for this one.
        previewTakeover.announce(rowId, READY_RETRY_MS);
        timers.current.open = window.setTimeout(() => tryOpen(triesLeft - 1), READY_RETRY_MS);
      } else {
        previewTakeover.cancel();
      }
    };
    const delay = previewOpenDelay(sinceLastPreviewMs());
    // The card of this row that is open now waits for this one, and the two change places at once.
    previewTakeover.announce(rowId, delay);
    timers.current.open = window.setTimeout(() => tryOpen(READY_RETRIES), delay);
  }, [clear, enabled, rowId]);

  // `towardNext` is false when the pointer left the row itself: nothing is about to take the
  // preview over, so the card need not wait for a neighbour before it starts to close.
  const closeAfter = useCallback(
    (ms: number) => {
      clear("leave");
      const close = () => {
        timers.current.leave = null;
        if (inside.current) return;
        // The pointer rests on another card of the row: stay open until that card takes over,
        // so the row does not move under it. Looked at again just after it was due.
        const wait = previewTakeover.waitMs(rowId);
        if (wait > 0 && rowRef.current?.expanded) {
          timers.current.leave = window.setTimeout(close, wait + TAKEOVER_GRACE_MS);
          return;
        }
        rowRef.current?.collapse();
        setWanted(false);
      };
      timers.current.leave = window.setTimeout(close, ms);
    },
    [clear, rowId],
  );

  const leave = useCallback(
    (towardNext = true) => {
      inside.current = false;
      // This card was waiting to open: it no longer is.
      if (timers.current.open !== null) previewTakeover.cancel();
      clear("open");
      clear("lookup");
      // Out of the row altogether: no card will take over, and a card left open is told so.
      if (!towardNext) previewTakeover.leftRow(rowId);
      closeAfter(towardNext ? PREVIEW_LEAVE_MS : PREVIEW_LEAVE_AWAY_MS);
    },
    [clear, closeAfter, rowId],
  );

  // An open card the pointer left for a neighbour closes at once when the pointer then leaves
  // the row from that neighbour.
  useEffect(() => {
    if (!open) return;
    return previewTakeover.onLeftRow(rowId, () => {
      if (!inside.current) closeAfter(PREVIEW_LEAVE_AWAY_MS);
    });
  }, [closeAfter, open, rowId]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setClosing(false), CLOSING_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    return markPreviewOpen();
  }, [open]);

  // Another card in the row took the preview: this one no longer wants its trailer.
  useEffect(() => {
    if (!open && !inside.current) setWanted(false);
  }, [open]);

  useEffect(
    () => () => {
      inside.current = false;
      if (timers.current.open !== null) previewTakeover.cancel();
      clear("open");
      clear("lookup");
      clear("leave");
      rowRef.current?.collapse();
    },
    [clear],
  );

  const onPointerEnter = useCallback(
    (event: PointerEvent) => {
      // A press that is already down is a drag along the row, not a rest on a card.
      if (event.pointerType !== "mouse" || event.buttons !== 0) return;
      arrive();
    },
    [arrive],
  );
  const onPointerLeave = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      leave(leftSideways(event.currentTarget, event.clientY));
    },
    [leave],
  );
  const onFocus = useCallback(() => {
    if (pointerModality()) return;
    arrive();
  }, [arrive]);
  const onBlur = useCallback(
    (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && event.currentTarget.contains(next)) return;
      if (pointerModality()) return;
      leave();
    },
    [leave],
  );

  return {
    enabled,
    open,
    wanted: wanted || open,
    /** The card shows, or is still putting away, what its preview adds: keep it mounted. */
    present: wanted || open || closing,
    /** The card is on its way back from open: what it wears while open settles in step. */
    closing,
    arrive,
    leave,
    handlers: { onPointerEnter, onPointerLeave, onFocus, onBlur },
  };
}

/**
 * The same behaviour for a card that is not written around the preview: it
 * listens on `host`, the card's own element, so the card only has to carry the
 * panel inside it.
 */
export function useCardPreviewOn(host: HTMLElement | null, measure: () => number) {
  const preview = useCardPreview(measure);
  const { enabled, arrive, leave, closing } = preview;

  // The host is the card: it settles from its lift in step with the closing (`.mac-lift`).
  useLayoutEffect(() => {
    if (!host) return;
    host.toggleAttribute("data-pv-closing", closing);
    return () => host.removeAttribute("data-pv-closing");
  }, [closing, host]);

  useEffect(() => {
    if (!enabled || !host) return;
    const onEnter = (event: globalThis.PointerEvent) => {
      if (event.pointerType !== "mouse" || event.buttons !== 0) return;
      arrive();
    };
    const onLeave = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "mouse") leave(leftSideways(host, event.clientY));
    };
    const onFocusIn = () => {
      if (!pointerModality()) arrive();
    };
    const onFocusOut = (event: globalThis.FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && host.contains(next)) return;
      if (!pointerModality()) leave();
    };
    host.addEventListener("pointerenter", onEnter);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("focusin", onFocusIn);
    host.addEventListener("focusout", onFocusOut);
    return () => {
      host.removeEventListener("pointerenter", onEnter);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("focusin", onFocusIn);
      host.removeEventListener("focusout", onFocusOut);
    };
  }, [arrive, enabled, host, leave]);

  return preview;
}

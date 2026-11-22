import { useEffect, useRef } from "react";
import type { HoldSpeed } from "./hooks/use-hold-speed";

/**
 * How long a click on the picture waits for a second one before it plays or
 * pauses. A double click is one gesture, full screen; acting on its first
 * click made the film pause and start again on the way there.
 */
export const CLICK_WAIT_MS = 220;

export function DragClickStage(props: {
  drawMode: boolean;
  pipMode: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onWheelVolume?: (deltaY: number) => void;
  holdSpeed?: HoldSpeed;
}) {
  const { drawMode, pipMode, onClick, onDoubleClick, onWheelVolume, holdSpeed } = props;
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  // The click that is waiting, and whether the last single click has already acted: a second
  // click that comes after the wait, but soon enough to be a double click, takes that back.
  const waiting = useRef<number | null>(null);
  const acted = useRef(false);

  useEffect(
    () => () => {
      if (waiting.current !== null) window.clearTimeout(waiting.current);
    },
    [],
  );

  // `count` is the browser's own count of clicks in a row: 2 for a double click's second.
  const released = (count: number) => {
    if (count >= 2) {
      if (waiting.current !== null) {
        window.clearTimeout(waiting.current);
        waiting.current = null;
      } else if (acted.current) {
        onClickRef.current();
      }
      acted.current = false;
      return;
    }
    if (waiting.current !== null) window.clearTimeout(waiting.current);
    acted.current = false;
    waiting.current = window.setTimeout(() => {
      waiting.current = null;
      acted.current = true;
      onClickRef.current();
    }, CLICK_WAIT_MS);
  };

  return (
    <div
      data-player-click-stage
      className="pointer-events-auto absolute inset-0 z-[3]"
      onWheel={(e) => {
        if (drawMode || pipMode) return;
        if (e.ctrlKey || e.metaKey) return;
        onWheelVolume?.(e.deltaY);
      }}
      onPointerDown={holdSpeed?.onPointerDown}
      onPointerUp={holdSpeed?.onPointerUp}
      onPointerCancel={holdSpeed?.onPointerCancel}
      onLostPointerCapture={holdSpeed?.onLostPointerCapture}
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (drawMode || pipMode) return;
        if (e.button !== 0) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const startTime = Date.now();
        let dragStarted = false;
        const onMove = (ev: MouseEvent) => {
          if (dragStarted) return;
          if (Date.now() - startTime < 150) return;
          const dx = Math.abs(ev.clientX - startX);
          const dy = Math.abs(ev.clientY - startY);
          if (dx > 8 || dy > 8) {
            dragStarted = true;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            // The pressure that started a window drag is not a speed hold.
            holdSpeed?.cancel();
            import("@tauri-apps/api/window")
              .then(({ getCurrentWindow }) => getCurrentWindow().startDragging())
              .catch(() => {});
          }
        };
        const onUp = (ev: MouseEvent) => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (!dragStarted && !holdSpeed?.consumeClick()) released(ev.detail);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (drawMode || pipMode) return;
        onDoubleClick();
      }}
    />
  );
}

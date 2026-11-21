import { useEffect, useRef } from "react";

/**
 * Calls `onDone` once a slide has been on show for `period` milliseconds of
 * running time. Stopping keeps the time already spent, so a pause resumes
 * where it left off; a new slide starts a full period. Paired with a progress
 * bar that pauses the same way, the bar and the change stay in step.
 */
export function useSlideTimer(input: {
  running: boolean;
  slide: number;
  period: number;
  onDone: () => void;
}): void {
  const { running, slide, period } = input;
  const onDone = useRef(input.onDone);
  onDone.current = input.onDone;
  const remaining = useRef(period);
  const timedSlide = useRef(slide);

  useEffect(() => {
    if (timedSlide.current !== slide) {
      timedSlide.current = slide;
      remaining.current = period;
    }
    if (!running) return;
    const started = performance.now();
    let fired = false;
    const id = window.setTimeout(() => {
      fired = true;
      remaining.current = period;
      onDone.current();
    }, remaining.current);
    return () => {
      window.clearTimeout(id);
      if (!fired)
        remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [running, slide, period]);
}

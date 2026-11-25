import { useEffect, useLayoutEffect, useRef } from "react";
import { useLeaveSoftly } from "@/lib/soft-leave";

/** How long the button takes to reach its new width when its label changes. */
const RESIZE_MS = 240;
/** Away promptly, then a settle: the curve the sidebar slides on. */
const RESIZE_EASE = "cubic-bezier(0.3, 0, 0.1, 1)";

/**
 * A labelled action beside Play on the macOS title page. Every action in that
 * row says what it is; the rest are in the More menu.
 *
 * An action that is a state changes its words and its glyph when pressed
 * ("Add to Watchlist" becomes "In Watchlist"). The old face fades out over the
 * new one fading in, and the button reaches its new width over the same time,
 * so the buttons after it move along instead of jumping.
 */
export function MacTitleButton({
  icon,
  label,
  hint,
  pressed,
  onClick,
  onWarm,
}: {
  icon: React.ReactNode;
  label: string;
  /** A longer explanation, shown by the system on hover. */
  hint?: string;
  /** For an action that is a state (in the watchlist, watched). */
  pressed?: boolean;
  onClick: () => void;
  /** Called when the pointer or focus reaches the button, to get ready. */
  onWarm?: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const width = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = button.current;
    if (!el) return;
    const before = width.current;
    const now = el.offsetWidth;
    width.current = now;
    if (before === null || before === now || now === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Clipped while it resizes: the new words are already their full length.
    el.style.overflow = "hidden";
    const resize = el.animate([{ width: `${before}px` }, { width: `${now}px` }], {
      duration: RESIZE_MS,
      easing: RESIZE_EASE,
    });
    const settle = () => el.style.removeProperty("overflow");
    resize.finished.then(settle, settle);
    return () => resize.cancel();
  }, [label]);

  // The first face comes with its page; only a face that replaces one fades in.
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
  }, []);

  return (
    <button
      ref={button}
      type="button"
      title={hint}
      aria-pressed={pressed}
      onClick={onClick}
      onPointerEnter={onWarm}
      onFocus={onWarm}
      className="mac-btn mac-btn-lg mac-btn-onart-quiet flex whitespace-nowrap"
    >
      <Face key={label} icon={icon} label={label} arrives={shown.current} />
    </button>
  );
}

/** The glyph and the words. Keyed by the words, so a change of state swaps one face for the next. */
function Face({
  icon,
  label,
  arrives,
}: {
  icon: React.ReactNode;
  label: string;
  arrives: boolean;
}) {
  const face = useRef<HTMLSpanElement>(null);
  useLeaveSoftly(face);
  return (
    <span ref={face} data-arrives={arrives ? "" : undefined} className="mac-btn-face">
      {icon}
      {label}
    </span>
  );
}

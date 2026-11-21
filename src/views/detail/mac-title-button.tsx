/**
 * A labelled action beside Play on the macOS title page. Every action in that
 * row says what it is; the rest are in the More menu.
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
  return (
    <button
      type="button"
      title={hint}
      aria-pressed={pressed}
      onClick={onClick}
      onPointerEnter={onWarm}
      onFocus={onWarm}
      className="mac-btn mac-btn-lg mac-btn-onart-quiet flex whitespace-nowrap"
    >
      {icon}
      {label}
    </button>
  );
}
